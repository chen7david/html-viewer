import { mediaDb } from '../../db/mediaDb';
import type { MediaPlaylist } from '../../types/Media';
import { ensureMediaDbReady } from './MediaDbBootstrap';

export class MediaPlaylistRepository {
  private static async ready(): Promise<void> {
    await ensureMediaDbReady();
  }

  static async getAll(): Promise<MediaPlaylist[]> {
    await MediaPlaylistRepository.ready();
    return mediaDb.playlists.orderBy('updatedAt').reverse().toArray();
  }

  static async getById(id: string): Promise<MediaPlaylist | undefined> {
    await MediaPlaylistRepository.ready();
    return mediaDb.playlists.get(id);
  }

  static async save(playlist: MediaPlaylist): Promise<void> {
    await MediaPlaylistRepository.ready();
    await mediaDb.playlists.put(playlist);
  }

  static async delete(id: string): Promise<void> {
    await MediaPlaylistRepository.ready();
    await mediaDb.playlists.delete(id);
  }
}
