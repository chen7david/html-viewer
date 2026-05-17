import { del, get, keys } from 'idb-keyval';
import { mediaDb, SETTINGS_ACTIVE_SCAN, SETTINGS_DIR_HANDLE } from '../../db/mediaDb';
import type { MediaLibraryScan, MediaPlaylist } from '../../types/Media';

const LEGACY_SCAN_KEY = 'media-library-scan';
const LEGACY_DIR_HANDLE_KEY = 'media-directory-handle';
const LEGACY_PLAYLIST_PREFIX = 'media-playlist-';

let initPromise: Promise<void> | null = null;

export function ensureMediaDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = migrateLegacyData().catch((err) => {
      console.error('Media DB migration failed:', err);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function migrateLegacyData(): Promise<void> {
  await mediaDb.open();

  const legacyScan = await get<MediaLibraryScan>(LEGACY_SCAN_KEY);
  if (legacyScan) {
    const hasDexie = await mediaDb.scanMeta.get(legacyScan.id);
    if (!hasDexie) {
      const { MediaScanRepository } = await import('./MediaScanRepository');
      const { MediaFileRepository } = await import('./MediaFileRepository');
      await MediaScanRepository.beginNewScan({
        id: legacyScan.id,
        rootName: legacyScan.rootName,
        scannedAt: legacyScan.scannedAt,
        fileCount: legacyScan.fileCount,
        totalBytes: legacyScan.totalBytes,
        status: legacyScan.status,
      });
      await MediaFileRepository.bulkUpsert(legacyScan.id, legacyScan.files);
    }
    await del(LEGACY_SCAN_KEY);
  }

  const legacyHandle = await get<FileSystemDirectoryHandle>(LEGACY_DIR_HANDLE_KEY);
  if (legacyHandle) {
    const existing = await mediaDb.settings.get(SETTINGS_DIR_HANDLE);
    if (!existing) {
      await mediaDb.settings.put({ key: SETTINGS_DIR_HANDLE, value: legacyHandle });
    }
    await del(LEGACY_DIR_HANDLE_KEY);
  }

  const allKeys = await keys();
  const legacyPlaylistKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(LEGACY_PLAYLIST_PREFIX),
  );
  for (const key of legacyPlaylistKeys) {
    const playlist = await get<MediaPlaylist>(key);
    if (playlist) {
      await mediaDb.playlists.put(playlist);
      await del(key);
    }
  }
}

export { SETTINGS_ACTIVE_SCAN, SETTINGS_DIR_HANDLE };
