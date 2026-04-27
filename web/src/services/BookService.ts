import { BookRepository } from '../repositories/BookRepository';
import type { StoredBook } from '../repositories/BookRepository';
import { AiParsingService } from './AiParsingService';
import { SettingsRepository } from '../repositories/SettingsRepository';

export class BookService {
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

    const originalPages = [...storedBook.book.pages];
    const totalPages = originalPages.length;
    const cleanedPages = [];
    
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
      
      // Re-integrate the valid returned JSON objects from the AI back into our true parsed page models
      for (const cleanedPage of cleanedChunk) {
        if (cleanedPage && cleanedPage.text && cleanedPage.text.trim() !== '') {
          cleanedPages.push({
            pageIndex: cleanedPage.pageIndex,
            text: cleanedPage.text
          });
        }
      }

      // Persist each completed batch immediately so users can inspect partial progress
      // without waiting for the whole book to finish.
      const cleanedMap = new Map(cleanedPages.map((p) => [p.pageIndex, p.text]));
      storedBook.book.pages = originalPages.map((page) => ({
        pageIndex: page.pageIndex,
        text: cleanedMap.get(page.pageIndex) ?? page.text,
      }));
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
    storedBook.book.pages = originalPages.map((page) => ({
      pageIndex: page.pageIndex,
      text: finalCleanedMap.get(page.pageIndex) ?? page.text,
    }));
    storedBook.aiProcessed = true;
    
    await BookRepository.saveBook(storedBook);
    return storedBook;
  }
}
