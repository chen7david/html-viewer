import { mediaDb } from '../../db/mediaDb';
import type { MediaScanMeta } from '../../types/Media';
import { ensureMediaDbReady, SETTINGS_ACTIVE_SCAN, SETTINGS_DIR_HANDLE } from './MediaDbBootstrap';

export class MediaScanRepository {
  private static async ready(): Promise<void> {
    await ensureMediaDbReady();
  }

  static async saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    await MediaScanRepository.ready();
    await mediaDb.settings.put({ key: SETTINGS_DIR_HANDLE, value: handle });
  }

  static async getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    await MediaScanRepository.ready();
    const row = await mediaDb.settings.get(SETTINGS_DIR_HANDLE);
    return row?.value as FileSystemDirectoryHandle | undefined;
  }

  static async clearDirectoryHandle(): Promise<void> {
    await MediaScanRepository.ready();
    await mediaDb.settings.delete(SETTINGS_DIR_HANDLE);
  }

  static async getActiveScanId(): Promise<string | undefined> {
    await MediaScanRepository.ready();
    const row = await mediaDb.settings.get(SETTINGS_ACTIVE_SCAN);
    return row?.value as string | undefined;
  }

  static async getScanMeta(scanId: string): Promise<MediaScanMeta | undefined> {
    await MediaScanRepository.ready();
    return mediaDb.scanMeta.get(scanId);
  }

  static async getActiveScanMeta(): Promise<MediaScanMeta | undefined> {
    const scanId = await MediaScanRepository.getActiveScanId();
    if (!scanId) return undefined;
    return MediaScanRepository.getScanMeta(scanId);
  }

  static async beginNewScan(meta: MediaScanMeta): Promise<void> {
    await MediaScanRepository.ready();
    await mediaDb.transaction('rw', mediaDb.scanMeta, mediaDb.mediaFiles, mediaDb.settings, async () => {
      const previousId = (await mediaDb.settings.get(SETTINGS_ACTIVE_SCAN))?.value as string | undefined;
      if (previousId && previousId !== meta.id) {
        await mediaDb.mediaFiles.where('scanId').equals(previousId).delete();
        await mediaDb.scanMeta.delete(previousId);
      }
      await mediaDb.mediaFiles.where('scanId').equals(meta.id).delete();
      await mediaDb.scanMeta.put(meta);
      await mediaDb.settings.put({ key: SETTINGS_ACTIVE_SCAN, value: meta.id });
    });
  }

  static async updateScanMeta(scanId: string, patch: Partial<MediaScanMeta>): Promise<void> {
    await MediaScanRepository.ready();
    await mediaDb.scanMeta.update(scanId, patch);
  }

  static async clearActiveScan(): Promise<void> {
    await MediaScanRepository.ready();
    const scanId = await MediaScanRepository.getActiveScanId();
    await mediaDb.transaction('rw', mediaDb.scanMeta, mediaDb.mediaFiles, mediaDb.settings, async () => {
      if (scanId) {
        await mediaDb.mediaFiles.where('scanId').equals(scanId).delete();
        await mediaDb.scanMeta.delete(scanId);
      }
      await mediaDb.settings.delete(SETTINGS_ACTIVE_SCAN);
    });
  }
}
