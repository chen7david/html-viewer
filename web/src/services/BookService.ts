import { BookRepository } from '../repositories/BookRepository';
import type { StoredBook } from '../repositories/BookRepository';
import { AiParsingService } from './AiParsingService';
import { SettingsRepository } from '../repositories/SettingsRepository';

export class BookService {
  private static isLikelyNonStoryPage(text: string): boolean {
    const normalized = text.toLowerCase();
    const nonStoryMarkers = [
      'words to know',
      'glossary',
      'connections',
      'writing',
      'social studies',
      'word count',
      'all rights reserved',
      'www.readinga-z.com',
      'reading a-z',
      'leveled book',
      'level o',
      'correlation',
    ];
    if (nonStoryMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    const visibleChars = text.replace(/\s/g, '');
    if (!visibleChars) return true;
    const alphaMatches = text.match(/[A-Za-z]/g) || [];
    const alphaRatio = alphaMatches.length / visibleChars.length;
    return alphaRatio < 0.45;
  }

  private static isLikelyNarrativePage(text: string): boolean {
    if (this.isLikelyNonStoryPage(text)) return false;
    const sentenceLike = (text.match(/[.!?]["')\]]?\s/g) || []).length;
    const wordCount = (text.match(/\b[\w'-]+\b/g) || []).length;
    return sentenceLike >= 2 && wordCount >= 40;
  }

  /**
   * Orchestrates the Gemini AI cleanup process on a previously parsed book.
   * Runs sequentially through all pages, filtering out covers/junk and semantically formatting the remaining text.
   */
  static async processBookWithAi(
    bookId: string, 
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<StoredBook> {
    const storedBook = await BookRepository.getBookById(bookId);
    if (!storedBook) throw new Error("Book not found in database.");

    const sourcePages = (storedBook.originalPages && storedBook.originalPages.length > 0)
      ? storedBook.originalPages
      : storedBook.book.pages;
    const originalPages = [...sourcePages];
    const totalPages = originalPages.length;
    const cleanedPages = [];
    const includedStoryPageIndexes = new Set<number>();

    if (storedBook.book.totalActualPages > totalPages) {
      throw new Error(
        "This book no longer has all original pages stored. Please re-upload the PDF once to restore full pages, then run AI clean again."
      );
    }
    
    const aiConfig = SettingsRepository.getAiSettings();
    const defaultChunkSize = aiConfig.activeProvider === 'gemini' ? 15 : 2;
    const chunkSize = Math.max(1, aiConfig.pagesPerBatch || defaultChunkSize);
    const throttleDelayMs = aiConfig.activeProvider === 'gemini' ? 4100 : 0;

    for (let i = 0; i < totalPages; i += chunkSize) {
      const chunk = originalPages.slice(i, i + chunkSize);
      const endIndex = Math.min(i + chunkSize, totalPages);
      
      if (onProgress) onProgress(endIndex, totalPages, `Analyzing Pages ${i + 1}-${endIndex} simultaneously...`);
      
      const chunkData = chunk.map(p => ({ pageIndex: p.pageIndex, text: p.text }));
      const cleanedChunk = await AiParsingService.processChunk(chunkData, storedBook.book.totalActualPages);
      
      const originalChunkMap = new Map(chunk.map((page) => [page.pageIndex, page.text]));

      // Re-integrate valid returned JSON objects from the AI back into our parsed page models.
      // If the model output is suspiciously short, keep the original text to prevent truncation.
      for (const cleanedPage of cleanedChunk) {
        if (cleanedPage && cleanedPage.text && cleanedPage.text.trim() !== '') {
          const originalText = originalChunkMap.get(cleanedPage.pageIndex) || '';
          const originalLen = originalText.trim().length;
          const cleanedLen = cleanedPage.text.trim().length;
          const looksTruncated = originalLen > 120 && cleanedLen < Math.floor(originalLen * 0.35);
          const finalText = looksTruncated ? originalText : cleanedPage.text;

          if (this.isLikelyNonStoryPage(finalText)) {
            continue;
          }

          cleanedPages.push({
            pageIndex: cleanedPage.pageIndex,
            text: finalText
          });
          includedStoryPageIndexes.add(cleanedPage.pageIndex);
        }
      }

      // Persist each completed batch immediately so users can inspect partial progress
      // without waiting for the whole book to finish.
      // Persist only likely story pages while still allowing safe fallback for missed narrative pages.
      const cleanedMap = new Map(cleanedPages.map((p) => [p.pageIndex, p.text]));
      const currentStoryPages = originalPages
        .filter((page) => includedStoryPageIndexes.has(page.pageIndex) || this.isLikelyNarrativePage(page.text))
        .map((page) => ({
          pageIndex: page.pageIndex,
          text: cleanedMap.get(page.pageIndex) ?? page.text,
        }));
      storedBook.book.pages = currentStoryPages;
      storedBook.originalPages = [...originalPages];
      storedBook.aiProcessed = endIndex >= totalPages;
      await BookRepository.saveBook(storedBook);

      if (endIndex < totalPages) {
        if (aiConfig.enableThrottling && throttleDelayMs > 0) {
          if (onProgress) onProgress(endIndex, totalPages, `Cooling down API to avoid rate limits...`);
          await new Promise(resolve => setTimeout(resolve, throttleDelayMs));
        }
      }
    }

    // Keep all original pages and only replace text for pages the AI cleaned.
    const finalCleanedMap = new Map(cleanedPages.map((p) => [p.pageIndex, p.text]));
    storedBook.book.pages = originalPages
      .filter((page) => includedStoryPageIndexes.has(page.pageIndex) || this.isLikelyNarrativePage(page.text))
      .map((page) => ({
        pageIndex: page.pageIndex,
        text: finalCleanedMap.get(page.pageIndex) ?? page.text,
      }));
    storedBook.originalPages = [...originalPages];
    storedBook.aiProcessed = true;
    
    await BookRepository.saveBook(storedBook);
    return storedBook;
  }
}
