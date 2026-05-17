export type MediaKind = 'video' | 'audio';

export type MediaMetadataStatus = 'pending' | 'complete' | 'skipped';

export interface MediaFileRecord {
  id: string;
  relativePath: string;
  name: string;
  extension: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  lastModified: number;
  duration?: number;
  width?: number;
  height?: number;
  fingerprint?: string;
  metadataStatus?: MediaMetadataStatus;
}

export type MediaLibraryScanStatus = 'indexing' | 'analyzing' | 'complete';

/** Scan summary stored in Dexie — files are separate rows. */
export interface MediaScanMeta {
  id: string;
  rootName: string;
  scannedAt: number;
  fileCount: number;
  totalBytes: number;
  status: MediaLibraryScanStatus;
}

/** In-memory snapshot during active scanning (includes file buffer). */
export interface MediaLibraryScan extends MediaScanMeta {
  files: MediaFileRecord[];
}

export type MediaKindFilter = MediaKind | 'all';

export interface MediaFilePageQuery {
  scanId: string;
  page: number;
  pageSize: number;
  search?: string;
  kind?: MediaKindFilter;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DuplicateGroup {
  fingerprint: string;
  files: MediaFileRecord[];
  wastedBytes: number;
}

export interface FolderProfile {
  folderPath: string;
  fileCount: number;
  videoCount: number;
  audioCount: number;
  totalBytes: number;
  suggestedDestination: string;
}

export interface MediaPlaylist {
  id: string;
  name: string;
  mediaIds: string[];
  createdAt: number;
  updatedAt: number;
}
