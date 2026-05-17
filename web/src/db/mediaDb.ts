import Dexie, { type Table } from 'dexie';
import type { MediaFileRecord, MediaPlaylist, MediaScanMeta } from '../types/Media';

export type { MediaScanMeta };

export interface StoredMediaFile extends MediaFileRecord {
  scanId: string;
}

interface MediaSettingRow {
  key: string;
  value: unknown;
}

export class MediaDatabase extends Dexie {
  scanMeta!: Table<MediaScanMeta, string>;
  mediaFiles!: Table<StoredMediaFile, string>;
  playlists!: Table<MediaPlaylist, string>;
  settings!: Table<MediaSettingRow, string>;

  constructor() {
    super('html-viewer-media');
    this.version(1).stores({
      scanMeta: 'id',
      mediaFiles: 'id, scanId, metadataStatus, size, fingerprint, kind, [scanId+metadataStatus]',
      playlists: 'id, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      scanMeta: 'id',
      mediaFiles:
        'id, scanId, metadataStatus, size, fingerprint, kind, relativePath, [scanId+metadataStatus], [scanId+kind]',
      playlists: 'id, updatedAt',
      settings: 'key',
    });
  }
}

export const mediaDb = new MediaDatabase();

export const SETTINGS_ACTIVE_SCAN = 'activeScanId';
export const SETTINGS_DIR_HANDLE = 'directoryHandle';
