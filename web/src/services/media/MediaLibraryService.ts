import {
  MediaFileRepository,
  MediaPlaylistRepository,
  MediaScanRepository,
} from '../../repositories/media';
import type {
  DuplicateGroup,
  FolderProfile,
  MediaFilePageQuery,
  MediaFileRecord,
  MediaPlaylist,
  MediaScanMeta,
  PaginatedResult,
} from '../../types/Media';
import {
  buildFolderProfiles,
  findDuplicateGroups,
  getFileByRelativePath,
  refineDuplicateFingerprints,
} from '../../utils/mediaScanner';

export class MediaLibraryService {
  static async loadAppState(): Promise<{
    scan?: MediaScanMeta;
    directoryHandle?: FileSystemDirectoryHandle;
    playlists: MediaPlaylist[];
  }> {
    const [scan, directoryHandle, playlists] = await Promise.all([
      MediaScanRepository.getActiveScanMeta(),
      MediaScanRepository.getDirectoryHandle(),
      MediaPlaylistRepository.getAll(),
    ]);
    return { scan, directoryHandle, playlists };
  }

  static async getFilesPage(query: MediaFilePageQuery): Promise<PaginatedResult<MediaFileRecord>> {
    return MediaFileRepository.queryPage(query);
  }

  static async countPendingMetadata(scanId: string): Promise<number> {
    return MediaFileRepository.countPending(scanId);
  }

  static async getPlaylistTracks(scanId: string, mediaIds: string[]): Promise<MediaFileRecord[]> {
    return MediaFileRepository.getByIds(scanId, mediaIds);
  }

  static async getFolderProfiles(scanId: string): Promise<FolderProfile[]> {
    const files = await MediaFileRepository.collectAll(scanId);
    return buildFolderProfiles(files);
  }

  static async getDuplicateGroups(scanId: string): Promise<DuplicateGroup[]> {
    const sizes = await MediaFileRepository.getDuplicateCandidateSizes(scanId);
    const candidates: MediaFileRecord[] = [];
    for (const size of sizes) {
      candidates.push(...(await MediaFileRepository.getBySize(scanId, size)));
    }
    return findDuplicateGroups(candidates);
  }

  /** Deep-hash same-size files and persist updated fingerprints. */
  static async refineDuplicatesOnDisk(
    scanId: string,
    directoryHandle: FileSystemDirectoryHandle,
    onProgress?: (message: string) => void,
  ): Promise<number> {
    const sizes = await MediaFileRepository.getDuplicateCandidateSizes(scanId);
    const candidates: MediaFileRecord[] = [];
    for (const size of sizes) {
      candidates.push(...(await MediaFileRepository.getBySize(scanId, size)));
    }
    return refineDuplicateFingerprints(
      candidates,
      (r) => getFileByRelativePath(directoryHandle, r.relativePath),
      onProgress,
      (record) => MediaFileRepository.upsert(scanId, record),
    );
  }

  static async resolveFile(
    directoryHandle: FileSystemDirectoryHandle,
    media: MediaFileRecord,
  ): Promise<File> {
    return getFileByRelativePath(directoryHandle, media.relativePath);
  }

  static async clearLibrary(): Promise<void> {
    await Promise.all([
      MediaScanRepository.clearActiveScan(),
      MediaScanRepository.clearDirectoryHandle(),
    ]);
  }
}
