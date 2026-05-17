import { mediaDb, type StoredMediaFile } from '../../db/mediaDb';
import type {
  MediaFilePageQuery,
  MediaFileRecord,
  MediaKindFilter,
  PaginatedResult,
} from '../../types/Media';
import { ensureMediaDbReady } from './MediaDbBootstrap';

function stripScanId({ scanId: _scanId, ...file }: StoredMediaFile): MediaFileRecord {
  return file;
}

function matchesSearch(file: MediaFileRecord, search: string): boolean {
  const q = search.toLowerCase();
  return file.name.toLowerCase().includes(q) || file.relativePath.toLowerCase().includes(q);
}

export class MediaFileRepository {
  private static async ready(): Promise<void> {
    await ensureMediaDbReady();
  }

  private static toStored(scanId: string, files: MediaFileRecord[]): StoredMediaFile[] {
    return files.map((f) => ({ ...f, scanId }));
  }

  static async bulkUpsert(scanId: string, files: MediaFileRecord[]): Promise<void> {
    if (files.length === 0) return;
    await MediaFileRepository.ready();
    await mediaDb.mediaFiles.bulkPut(MediaFileRepository.toStored(scanId, files));
  }

  static async upsert(scanId: string, file: MediaFileRecord): Promise<void> {
    await MediaFileRepository.ready();
    await mediaDb.mediaFiles.put({ ...file, scanId });
  }

  static async countByScan(scanId: string): Promise<number> {
    await MediaFileRepository.ready();
    return mediaDb.mediaFiles.where('scanId').equals(scanId).count();
  }

  static async countPending(scanId: string): Promise<number> {
    await MediaFileRepository.ready();
    return mediaDb.mediaFiles.where('[scanId+metadataStatus]').equals([scanId, 'pending']).count();
  }

  static async getPending(scanId: string): Promise<MediaFileRecord[]> {
    await MediaFileRepository.ready();
    const rows = await mediaDb.mediaFiles.where('[scanId+metadataStatus]').equals([scanId, 'pending']).toArray();
    return rows.map(stripScanId);
  }

  static async getByIds(scanId: string, ids: string[]): Promise<MediaFileRecord[]> {
    if (ids.length === 0) return [];
    await MediaFileRepository.ready();
    const rows = await mediaDb.mediaFiles.where('scanId').equals(scanId).and((f) => ids.includes(f.id)).toArray();
    return rows.map(stripScanId);
  }

  static async getBySize(scanId: string, size: number): Promise<MediaFileRecord[]> {
    await MediaFileRepository.ready();
    const rows = await mediaDb.mediaFiles.where('scanId').equals(scanId).filter((f) => f.size === size).toArray();
    return rows.map(stripScanId);
  }

  /** Sizes that appear more than once (duplicate candidates). */
  static async getDuplicateCandidateSizes(scanId: string): Promise<number[]> {
    await MediaFileRepository.ready();
    const counts = new Map<number, number>();
    await mediaDb.mediaFiles.where('scanId').equals(scanId).each((file) => {
      counts.set(file.size, (counts.get(file.size) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([size]) => size);
  }

  static async queryPage(query: MediaFilePageQuery): Promise<PaginatedResult<MediaFileRecord>> {
    await MediaFileRepository.ready();
    const { scanId, page, pageSize, search = '', kind = 'all' } = query;

    let collection =
      kind === 'all'
        ? mediaDb.mediaFiles.where('scanId').equals(scanId)
        : mediaDb.mediaFiles.where('[scanId+kind]').equals([scanId, kind]);

    if (search.trim()) {
      const term = search.trim();
      collection = collection.filter((f) => matchesSearch(f, term));
    }

    const sorted = await collection.sortBy('relativePath');
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  /** Stream all files for aggregate operations (folder profile, duplicate grouping). */
  static async collectAll(scanId: string, kind?: MediaKindFilter): Promise<MediaFileRecord[]> {
    await MediaFileRepository.ready();
    let collection = mediaDb.mediaFiles.where('scanId').equals(scanId);
    if (kind && kind !== 'all') {
      collection = mediaDb.mediaFiles.where('[scanId+kind]').equals([scanId, kind]);
    }
    const rows = await collection.sortBy('relativePath');
    return rows.map(stripScanId);
  }
}
