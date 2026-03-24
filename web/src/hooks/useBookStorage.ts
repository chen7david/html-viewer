import { useState, useEffect } from 'react';
import type { ParsedBook } from '../utils/pdfParser';
import { BookRepository } from '../repositories/BookRepository';
import type { StoredBookSummary, StoredBook } from '../repositories/BookRepository';
import { v4 as uuidv4 } from 'uuid';

export { type StoredBookSummary, type StoredBook };

export function useBookStorage() {
  const [books, setBooks] = useState<StoredBookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Delegate entirely to BookRepository instead of writing manual IDB here
  const loadBookMetadata = async () => {
    setIsLoading(true);
    try {
      const summaries = await BookRepository.getAllBookSummaries();
      setBooks(summaries);
    } catch (error) {
      console.error("Failed to load books from DB via Repository", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookMetadata();
  }, []);

  const saveBook = async (book: ParsedBook): Promise<string> => {
    const id = uuidv4();
    const newBook: StoredBook = {
      id,
      book,
      createdAt: Date.now(),
      aiProcessed: false
    };
    await BookRepository.saveBook(newBook);
    await loadBookMetadata();
    return id;
  };

  const getBook = async (id: string): Promise<StoredBook | undefined> => {
    return await BookRepository.getBookById(id);
  };

  const deleteBook = async (id: string) => {
    await BookRepository.deleteBook(id);
    await loadBookMetadata();
  };

  return {
    books,
    isLoading,
    saveBook,
    getBook,
    deleteBook,
    reloadMetadata: loadBookMetadata
  };
}
