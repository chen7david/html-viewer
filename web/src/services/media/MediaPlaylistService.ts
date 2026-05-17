import { MediaPlaylistRepository } from '../../repositories/media';
import type { MediaPlaylist } from '../../types/Media';
import { v4 as uuidv4 } from 'uuid';

export class MediaPlaylistService {
  static async getAll(): Promise<MediaPlaylist[]> {
    return MediaPlaylistRepository.getAll();
  }

  static async create(name: string, mediaIds: string[]): Promise<MediaPlaylist> {
    const now = Date.now();
    const playlist: MediaPlaylist = {
      id: uuidv4(),
      name: name.trim(),
      mediaIds,
      createdAt: now,
      updatedAt: now,
    };
    await MediaPlaylistRepository.save(playlist);
    return playlist;
  }

  static async update(id: string, updates: Partial<Pick<MediaPlaylist, 'name' | 'mediaIds'>>): Promise<void> {
    const existing = await MediaPlaylistRepository.getById(id);
    if (!existing) throw new Error('Playlist not found.');
    await MediaPlaylistRepository.save({
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }

  static async delete(id: string): Promise<void> {
    await MediaPlaylistRepository.delete(id);
  }
}
