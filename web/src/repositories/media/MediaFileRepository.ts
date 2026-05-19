import { mediaDb, type StoredMediaFile } from '../../db/mediaDb';
import type {
  MediaFilePageQuery,
  MediaFileRecord,
  MediaKindFilter,
  PaginatedResult,
} from '../../types/Media';
import { applyMediaTags, fileMatchesTags } from '../../utils/mediaTags';
import { getResolutionLabel } from '../../utils/videoResolution';
import { ensureMediaDbReady } from './MediaDbBootstrap';

function stripScanId({ scanId: _scanId, ...file }: StoredMediaFile): MediaFileRecord {
  return file;
}

function matchesSearch(file: MediaFileRecord, search: string): boolean {
  const q = search.toLowerCase();
  const tagHit = (file.tags ?? []).some((t) => t.includes(q));
  const display = file.displayName?.toLowerCase() ?? '';
  return (
    tagHit ||
    display.includes(q) ||
    file.name.toLowerCase().includes(q) ||
    file.relativePath.toLowerCase().includes(q) ||
    (file.resolutionLabel?.toLowerCase().includes(q) ?? false)
  );
}

function normalizeFile(file: MediaFileRecord): MediaFileRecord {
  const resolutionLabel =
    file.resolutionLabel ?? getResolutionLabel(file.width, file.height);
  const withResolution = { ...file, resolutionLabel };
  if (withResolution.tags && withResolution.tags.length > 0) return withResolution;
  return applyMediaTags(withResolution);
}

function matchesResolution(file: MediaFileRecord, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const label = file.resolutionLabel ?? getResolutionLabel(file.width, file.height);
  if (!label) return false;
  return labels.includes(label);
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

  static async deleteById(scanId: string, id: string): Promise<void> {
    await MediaFileRepository.ready();
    const row = await mediaDb.mediaFiles.get(id);
    if (row?.scanId === scanId) await mediaDb.mediaFiles.delete(id);
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

  /** Lookup by primary key — file ids are globally unique (not scoped to scan query). */
  static async getById(mediaId: string): Promise<MediaFileRecord | undefined> {
    await MediaFileRepository.ready();
    const row = await mediaDb.mediaFiles.get(mediaId);
    return row ? normalizeFile(stripScanId(row)) : undefined;
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
    const {
      scanId,
      page,
      pageSize,
      search = '',
      kind = 'all',
      tags = [],
      resolutionLabels = [],
    } = query;

    let rows = (await mediaDb.mediaFiles.where('scanId').equals(scanId).toArray())
      .map(stripScanId)
      .map(normalizeFile);

    if (kind !== 'all') {
      rows = rows.filter((f) => f.kind === kind);
    }

    if (resolutionLabels.length > 0) {
      rows = rows.filter((f) => matchesResolution(f, resolutionLabels));
    }

    if (search.trim()) {
      const term = search.trim();
      rows = rows.filter((f) => matchesSearch(f, term));
    }

    if (tags.length > 0) {
      rows = rows.filter((f) => fileMatchesTags(f, tags));
    }

    rows.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  static async getBrowseFacets(scanId: string, kind: MediaKindFilter = 'video'): Promise<{
    tags: string[];
    resolutionLabels: string[];
  }> {
    await MediaFileRepository.ready();
    const tagSet = new Set<string>();
    const resolutionSet = new Set<string>();

    let collection = mediaDb.mediaFiles.where('scanId').equals(scanId);
    if (kind !== 'all') {
      collection = mediaDb.mediaFiles.where('[scanId+kind]').equals([scanId, kind]);
    }

    await collection.each((row) => {
      const file = normalizeFile(stripScanId(row));
      for (const tag of file.tags ?? []) tagSet.add(tag);
      const label = file.resolutionLabel ?? getResolutionLabel(file.width, file.height);
      if (label) resolutionSet.add(label);
    });

    const resolutionOrder = ['8K', '4K', '1440p', '1080p', '720p', '576p', '480p', '360p', '240p'];
    const resolutionLabels = [...resolutionSet].sort(
      (a, b) => resolutionOrder.indexOf(a) - resolutionOrder.indexOf(b),
    );

    return {
      tags: [...tagSet].sort(),
      resolutionLabels,
    };
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
