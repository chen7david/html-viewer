import { LinksRepository } from '../repositories/LinksRepository';
import type { LinkEntity } from '../types/Link';

export class LinksService {
  static async getAllLinks(): Promise<LinkEntity[]> {
    const links = await LinksRepository.getAllLinks();
    // Default sorting mandate: Newest copied to the top
    return links.sort((a, b) => b.lastCopiedAt - a.lastCopiedAt);
  }

  static async addLink(name: string, url: string, tags: string[] = []): Promise<LinkEntity> {
    const links = await LinksRepository.getAllLinks();
    
    // Auto-formatting url to ensure protocol
    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
       formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: LinkEntity = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Link',
      url: formattedUrl,
      tags: Array.from(new Set(tags.map(t => t.trim().toLowerCase()))).filter(Boolean), // Deduplicate and normalize
      isDead: false,
      lastCopiedAt: Date.now(), // Treat original creation as a copied event for high priority sorting
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    links.push(newLink);
    await LinksRepository.saveLinks(links);
    return newLink;
  }

  static async updateLink(id: string, updates: Partial<Omit<LinkEntity, 'id' | 'createdAt'>>): Promise<void> {
    const links = await LinksRepository.getAllLinks();
    const index = links.findIndex(l => l.id === id);
    if (index > -1) {
      // If updating tags, normalize them again
      if (updates.tags) {
        updates.tags = Array.from(new Set(updates.tags.map(t => t.trim().toLowerCase()))).filter(Boolean);
      }
      
      links[index] = { ...links[index], ...updates, updatedAt: Date.now() };
      await LinksRepository.saveLinks(links);
    }
  }

  static async deleteLink(id: string): Promise<void> {
    let links = await LinksRepository.getAllLinks();
    links = links.filter(l => l.id !== id);
    await LinksRepository.saveLinks(links);
  }

  /**
   * Instantly bumps a link to the absolute top of the default UI view
   */
  static async markCopied(id: string): Promise<void> {
    await this.updateLink(id, { lastCopiedAt: Date.now() });
  }

  /**
   * Analyzes all saved links and compiles a master list of all globally unique tags
   */
  static async getAllTags(): Promise<string[]> {
    const links = await LinksRepository.getAllLinks();
    const tagSet = new Set<string>();
    links.forEach(l => {
      l.tags?.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }
}
