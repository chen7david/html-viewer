import { get, set } from 'idb-keyval';
import type { LinkEntity } from '../types/Link';

const LINKS_STORE_KEY = 'html-viewer-links-v1';

export class LinksRepository {
  /**
   * Fetch all strictly typed Link Entities from native IndexedDB
   */
  static async getAllLinks(): Promise<LinkEntity[]> {
    try {
      const data = await get<LinkEntity[]>(LINKS_STORE_KEY);
      return data || [];
    } catch (e) {
      console.error('Failed to get links from IndexedDB', e);
      return [];
    }
  }

  /**
   * Save array of strictly typed Link Entities to native IndexedDB
   */
  static async saveLinks(links: LinkEntity[]): Promise<void> {
    await set(LINKS_STORE_KEY, links);
  }
}
