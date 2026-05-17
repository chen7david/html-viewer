import { v4 as uuidv4 } from 'uuid';
import { MediaFileRepository, MediaScanRepository } from '../../repositories/media';
import type { MediaFileRecord, MediaLibraryScan, MediaScanMeta } from '../../types/Media';
import {
  collectMediaFiles,
  computeQuickFingerprint,
  extractMediaMetadata,
  getFileByRelativePath,
  pickMediaDirectory,
  verifyDirectoryPermission,
  yieldToMain,
} from '../../utils/mediaScanner';
import { MediaLibraryService } from './MediaLibraryService';

export interface MediaScanCallbacks {
  onProgress?: (message: string) => void;
  onMetaUpdate?: (meta: MediaScanMeta) => void;
  onLibraryRefresh?: () => void;
}

export class MediaScanService {
  static async pickAndScanFolder(callbacks?: MediaScanCallbacks): Promise<{
    scan: MediaScanMeta;
    directoryHandle: FileSystemDirectoryHandle;
  }> {
    const directoryHandle = await pickMediaDirectory();
    const granted = await verifyDirectoryPermission(directoryHandle, 'read');
    if (!granted) throw new Error('Folder read permission was denied.');

    await MediaScanRepository.saveDirectoryHandle(directoryHandle);
    const scan = await MediaScanService.runFullScan(directoryHandle, callbacks);
    return { scan, directoryHandle };
  }

  static async rescanSavedFolder(
    directoryHandle: FileSystemDirectoryHandle,
    callbacks?: MediaScanCallbacks,
  ): Promise<MediaScanMeta> {
    const granted = await verifyDirectoryPermission(directoryHandle, 'read');
    if (!granted) {
      throw new Error('Folder read permission was denied. Click “Reconnect folder” and allow access.');
    }
    return MediaScanService.runFullScan(directoryHandle, callbacks);
  }

  static async resumeAnalysis(
    directoryHandle: FileSystemDirectoryHandle,
    scanMeta: MediaScanMeta,
    callbacks?: MediaScanCallbacks,
  ): Promise<MediaScanMeta> {
    const granted = await verifyDirectoryPermission(directoryHandle, 'read');
    if (!granted) {
      throw new Error('Folder read permission was denied. Click “Reconnect folder” and allow access.');
    }
    return MediaScanService.analyzePendingFiles(directoryHandle, scanMeta, callbacks);
  }

  private static async runFullScan(
    directoryHandle: FileSystemDirectoryHandle,
    callbacks?: MediaScanCallbacks,
  ): Promise<MediaScanMeta> {
    const onProgress = callbacks?.onProgress;
    const onMetaUpdate = callbacks?.onMetaUpdate;
    const onLibraryRefresh = callbacks?.onLibraryRefresh;

    onProgress?.('Discovering media files…');
    const collected = await collectMediaFiles(directoryHandle, (count) => {
      onProgress?.(`Found ${count} media file(s)…`);
    });

    const scanId = uuidv4();
    const rootName = directoryHandle.name;
    let totalBytes = 0;
    let fileCount = 0;
    let batch: MediaFileRecord[] = [];

    await MediaScanRepository.beginNewScan({
      id: scanId,
      rootName,
      scannedAt: Date.now(),
      fileCount: 0,
      totalBytes: 0,
      status: 'indexing',
    });

    const publishMeta = async (phase: string, status: MediaScanMeta['status']) => {
      const meta: MediaScanMeta = {
        id: scanId,
        rootName,
        scannedAt: Date.now(),
        fileCount,
        totalBytes,
        status,
      };
      onProgress?.(phase);
      onMetaUpdate?.(meta);
      await MediaScanRepository.updateScanMeta(scanId, meta);
      onLibraryRefresh?.();
      return meta;
    };

    onProgress?.('Building file index…');
    for (let i = 0; i < collected.length; i++) {
      const { file, record } = collected[i];
      const fingerprint = await computeQuickFingerprint(file, record.relativePath);
      const entry: MediaFileRecord = { ...record, fingerprint, metadataStatus: 'pending' };
      batch.push(entry);
      fileCount += 1;
      totalBytes += entry.size;

      if (batch.length >= 50 || i === collected.length - 1) {
        await MediaFileRepository.bulkUpsert(scanId, batch);
        batch = [];
        await publishMeta(`Indexed ${i + 1}/${collected.length} files…`, 'indexing');
        await yieldToMain();
      }
    }

    await publishMeta(`Indexed ${fileCount} files. Reading metadata…`, 'analyzing');

    return MediaScanService.analyzePendingFiles(
      directoryHandle,
      {
        id: scanId,
        rootName,
        scannedAt: Date.now(),
        fileCount,
        totalBytes,
        status: 'analyzing',
      },
      callbacks,
    );
  }

  private static async analyzePendingFiles(
    directoryHandle: FileSystemDirectoryHandle,
    scanMeta: MediaScanMeta,
    callbacks?: MediaScanCallbacks,
  ): Promise<MediaScanMeta> {
    const onProgress = callbacks?.onProgress;
    const onMetaUpdate = callbacks?.onMetaUpdate;
    const onLibraryRefresh = callbacks?.onLibraryRefresh;
    const { id: scanId, rootName } = scanMeta;

    const pending = await MediaFileRepository.getPending(scanId);
    let metadataSkipped = 0;

    let runningTotalBytes = scanMeta.totalBytes;

    const publishMeta = async (phase: string, status: MediaScanMeta['status']) => {
      const fileCount = await MediaFileRepository.countByScan(scanId);
      const meta: MediaScanMeta = {
        id: scanId,
        rootName,
        scannedAt: Date.now(),
        fileCount,
        totalBytes: runningTotalBytes,
        status,
      };
      onProgress?.(phase);
      onMetaUpdate?.(meta);
      await MediaScanRepository.updateScanMeta(scanId, meta);
      onLibraryRefresh?.();
      return meta;
    };

    if (pending.length > 0) {
      await publishMeta(`Reading metadata for ${pending.length} remaining file(s)…`, 'analyzing');

      for (let i = 0; i < pending.length; i++) {
        const target = pending[i];
        onProgress?.(`Metadata ${i + 1}/${pending.length}: ${target.name}`);

        try {
          const file = await getFileByRelativePath(directoryHandle, target.relativePath);
          const metadata = await extractMediaMetadata(file, target.kind);
          if (Object.keys(metadata).length === 0 && file.size > 0) {
            target.metadataStatus = 'skipped';
            metadataSkipped += 1;
          } else {
            Object.assign(target, metadata);
            target.metadataStatus = 'complete';
          }
        } catch {
          target.metadataStatus = 'skipped';
          metadataSkipped += 1;
        }

        await MediaFileRepository.upsert(scanId, target);

        if (i % 5 === 0 || i === pending.length - 1) {
          await publishMeta(
            `Metadata ${i + 1}/${pending.length}${metadataSkipped ? ` (${metadataSkipped} skipped)` : ''}`,
            'analyzing',
          );
        }
        await yieldToMain();
      }
    }

    const hashTargets = await MediaLibraryService.refineDuplicatesOnDisk(
      scanId,
      directoryHandle,
      onProgress,
    );
    if (hashTargets > 0) {
      await publishMeta(`Duplicate check complete (${hashTargets} same-size candidates)`, 'analyzing');
    }

    const fileCount = await MediaFileRepository.countByScan(scanId);
    const files = await MediaFileRepository.collectAll(scanId);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    const finalMeta: MediaScanMeta = {
      id: scanId,
      rootName,
      scannedAt: Date.now(),
      fileCount,
      totalBytes,
      status: 'complete',
    };
    onMetaUpdate?.(finalMeta);
    await MediaScanRepository.updateScanMeta(scanId, finalMeta);
    onLibraryRefresh?.();
    return finalMeta;
  }

  /** Build in-memory scan snapshot for legacy callers. */
  static async assembleFullScan(scanId: string): Promise<MediaLibraryScan | undefined> {
    const meta = await MediaScanRepository.getScanMeta(scanId);
    if (!meta) return undefined;
    const files = await MediaFileRepository.collectAll(scanId);
    return { ...meta, files };
  }
}
