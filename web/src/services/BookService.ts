import { BookRepository } from '../repositories/BookRepository';
import type { StoredBook } from '../repositories/BookRepository';
import { AiParsingService } from './AiParsingService';

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

    const totalPages = storedBook.book.pages.length;
    const cleanedPages = [];
    const CHUNK_SIZE = 15; // Process 15 pages in a single API prompt to save network limits

    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const chunk = storedBook.book.pages.slice(i, i + CHUNK_SIZE);
      const endIndex = Math.min(i + CHUNK_SIZE, totalPages);
      
      if (onProgress) onProgress(endIndex, totalPages, `Analyzing Pages ${i + 1}-${endIndex} simultaneously...`);
      
      const chunkData = chunk.map(p => ({ pageIndex: p.pageIndex, text: p.text }));
      const cleanedChunk = await AiParsingService.processChunk(chunkData, storedBook.book.totalActualPages);
      
      // Re-integrate the valid returned JSON objects from the AI back into our true parsed page models
      for (const cleanedPage of cleanedChunk) {
        if (cleanedPage && cleanedPage.text && cleanedPage.text.trim() !== '') {
          // Find original page to preserve any other metadata like inDocumentPageNumber
          const original = chunk.find(c => c.pageIndex === cleanedPage.pageIndex);
          if (original) {
            cleanedPages.push({
              ...original,
              text: cleanedPage.text
            });
          }
        }
      }

      // Google AI Studio Free Tier allows 15 requests per minute (4 seconds per req).
      // Since we chunk 15 pages at a time, we barely hit this, but we maintain a 4.1s wait just to be bulletproof.
      if (endIndex < totalPages) {
        if (onProgress) onProgress(endIndex, totalPages, `Cooling down API (15 RPM limit)...`);
        await new Promise(resolve => setTimeout(resolve, 4100));
      }
    }

    // Overwrite the book's pages array with the strictly curated AI pages
    storedBook.book.pages = cleanedPages;
    storedBook.aiProcessed = true;
    
    await BookRepository.saveBook(storedBook);
    return storedBook;
  }
}
