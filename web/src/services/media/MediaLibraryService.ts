import {
  MediaFileRepository,
  MediaPlaylistRepository,
  MediaScanRepository,
} from '../../repositories/media';
import type {
  DuplicateGroup,
  FolderProfile,
  MediaBrowseFacets,
  MediaFilePageQuery,
  MediaFileRecord,
  MediaKindFilter,
  MediaPlaylist,
  MediaScanMeta,
  PaginatedResult,
} from '../../types/Media';
import { applyMediaTags } from '../../utils/mediaTags';
import { clampMediaRating, isValidMediaRating } from '../../utils/mediaRating';
import { ensureWritePermission, moveFileToDeletedFolder } from '../../utils/mediaFileOps';
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

  static async getBrowseFacets(scanId: string, kind: MediaKindFilter = 'video'): Promise<MediaBrowseFacets> {
    return MediaFileRepository.getBrowseFacets(scanId, kind);
  }

  static async getFileById(mediaId: string): Promise<MediaFileRecord | undefined> {
    return MediaFileRepository.getById(mediaId);
  }

  static async getVideoById(_scanId: string, mediaId: string): Promise<MediaFileRecord | undefined> {
    const file = await MediaFileRepository.getById(mediaId);
    if (!file || file.kind !== 'video') return undefined;
    return file;
  }

  static async getAllVideos(scanId: string): Promise<MediaFileRecord[]> {
    return MediaFileRepository.collectAll(scanId, 'video');
  }

  static async countPendingMetadata(scanId: string): Promise<number> {
    return MediaFileRepository.countPending(scanId);
  }

  static async getPlaylistTracks(scanId: string, mediaIds: string[]): Promise<MediaFileRecord[]> {
    const files = await MediaFileRepository.getByIds(scanId, mediaIds);
    const byId = new Map(files.map((f) => [f.id, f]));
    return mediaIds.map((id) => byId.get(id)).filter((f): f is MediaFileRecord => Boolean(f));
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

  static async updateRating(
    scanId: string,
    mediaId: string,
    rating: number | null | undefined,
  ): Promise<MediaFileRecord> {
    const existing = await MediaFileRepository.getByIds(scanId, [mediaId]);
    const file = existing[0];
    if (!file) throw new Error('File not found in library.');

    let nextRating: number | undefined;
    if (rating === null || rating === undefined || rating === 0) {
      nextRating = undefined;
    } else if (isValidMediaRating(rating)) {
      nextRating = clampMediaRating(rating);
    } else {
      throw new Error(`Rating must be between 1 and 5.`);
    }

    const updated = { ...file, rating: nextRating };
    await MediaFileRepository.upsert(scanId, updated);
    return updated;
  }

  static async updateFileMetadata(
    scanId: string,
    mediaId: string,
    patch: { displayName?: string; userTags?: string[] },
  ): Promise<MediaFileRecord> {
    const existing = await MediaFileRepository.getByIds(scanId, [mediaId]);
    const file = existing[0];
    if (!file) throw new Error('File not found in library.');

    const userTags = (patch.userTags ?? file.userTags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const updated = applyMediaTags({
      ...file,
      displayName: patch.displayName !== undefined ? patch.displayName.trim() || undefined : file.displayName,
      userTags,
    });

    await MediaFileRepository.upsert(scanId, updated);
    return updated;
  }

  static async moveFileToDeleted(
    scanId: string,
    directoryHandle: FileSystemDirectoryHandle,
    file: MediaFileRecord,
  ): Promise<void> {
    const canWrite = await ensureWritePermission(directoryHandle);
    if (!canWrite) {
      throw new Error('Write permission is required to move files. Reconnect the folder and allow editing.');
    }
    await moveFileToDeletedFolder(directoryHandle, file.relativePath);
    await MediaFileRepository.deleteById(scanId, file.id);
  }

  static async moveDuplicateCopiesToDeleted(
    scanId: string,
    directoryHandle: FileSystemDirectoryHandle,
    group: DuplicateGroup,
  ): Promise<{ moved: number; errors: string[] }> {
    const copies = group.files.filter((f) => f.id !== group.keeper.id);
    let moved = 0;
    const errors: string[] = [];

    for (const file of copies) {
      try {
        await MediaLibraryService.moveFileToDeleted(scanId, directoryHandle, file);
        moved += 1;
      } catch (err) {
        errors.push(`${file.relativePath}: ${err instanceof Error ? err.message : 'Move failed'}`);
      }
    }

    return { moved, errors };
  }
}
