import { set, get, keys, del } from 'idb-keyval';
import type { ParsedBook } from '../utils/pdfParser';

export interface StoredBook {
  id: string;
  book: ParsedBook;
  createdAt: number;
  aiProcessed: boolean;
}

export interface StoredBookSummary {
  id: string;
  book: { title: string; totalActualPages: number; pages: any[] };
  createdAt: number;
  aiProcessed: boolean;
}

const STORE_PREFIX = 'pdf-book-';

export class BookRepository {
  static async getAllBookSummaries(): Promise<StoredBookSummary[]> {
    const allStoreKeys = await keys();
    const bookKeys = allStoreKeys.filter((k) => typeof k === 'string' && k.startsWith(STORE_PREFIX));
    
    const loadedMetadata: StoredBookSummary[] = [];
    for (const k of bookKeys) {
      const fullBook = await get<StoredBook>(k);
      if (fullBook) {
        loadedMetadata.push({
          id: fullBook.id,
          createdAt: fullBook.createdAt,
          aiProcessed: fullBook.aiProcessed || false,
          book: {
            title: fullBook.book.title,
            totalActualPages: fullBook.book.totalActualPages,
            pages: [],
          }
        });
      }
    }
    return loadedMetadata.sort((a, b) => b.createdAt - a.createdAt);
  }

  static async getBookById(id: string): Promise<StoredBook | undefined> {
    return await get<StoredBook>(`${STORE_PREFIX}${id}`);
  }

  static async saveBook(book: StoredBook): Promise<void> {
    await set(`${STORE_PREFIX}${book.id}`, book);
  }

  static async deleteBook(id: string): Promise<void> {
    await del(`${STORE_PREFIX}${id}`);
  }
}
