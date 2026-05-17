import { v4 as uuidv4 } from 'uuid';
import type { DuplicateGroup, FolderProfile, MediaFileRecord, MediaKind } from '../types/Media';
import { classifyMediaFile } from './mediaExtensions';

const CHUNK_SIZE = 64 * 1024;
export const METADATA_TIMEOUT_MS = 8_000;
const WALK_YIELD_EVERY = 40;

/** Lets React paint progress between heavy file operations. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickMediaDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Your browser does not support folder picking. Use Chrome or Edge on desktop.');
  }
  return window.showDirectoryPicker({ mode: 'read' });
}

export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'read',
): Promise<boolean> {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  onFile: (file: File, relativePath: string) => void | Promise<void>,
): Promise<void> {
  for await (const entry of dirHandle.values()) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      await walkDirectory(entry as FileSystemDirectoryHandle, relativePath, onFile);
    } else if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile();
      await onFile(file, relativePath);
    }
  }
}

export async function collectMediaFiles(
  root: FileSystemDirectoryHandle,
  onProgress?: (found: number) => void,
): Promise<{ file: File; relativePath: string; record: Omit<MediaFileRecord, 'duration' | 'width' | 'height' | 'fingerprint'> }[]> {
  const results: { file: File; relativePath: string; record: Omit<MediaFileRecord, 'duration' | 'width' | 'height' | 'fingerprint'> }[] = [];
  let sinceYield = 0;

  await walkDirectory(root, '', async (file, relativePath) => {
    const classified = classifyMediaFile(file.name);
    if (!classified) return;

    results.push({
      file,
      relativePath,
      record: {
        id: uuidv4(),
        relativePath,
        name: file.name,
        extension: classified.extension,
        mimeType: classified.mimeType,
        kind: classified.kind,
        size: file.size,
        lastModified: file.lastModified,
      },
    });
    onProgress?.(results.length);

    sinceYield += 1;
    if (sinceYield >= WALK_YIELD_EVERY) {
      sinceYield = 0;
      await yieldToMain();
    }
  });

  return results;
}

/** Fast fingerprint without reading file bytes — used during initial index. */
export async function computeQuickFingerprint(file: File, relativePath: string): Promise<string> {
  const payload = `${file.size}|${file.name}|${file.lastModified}|${relativePath}`;
  const buf = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Content-aware fingerprint — only run for likely-duplicate candidates (same byte size). */
export async function computeFileFingerprint(file: File): Promise<string> {
  const parts: ArrayBuffer[] = [];
  const head = file.slice(0, CHUNK_SIZE);
  parts.push(await head.arrayBuffer());

  if (file.size > CHUNK_SIZE) {
    const tailStart = Math.max(0, file.size - CHUNK_SIZE);
    const tail = file.slice(tailStart);
    parts.push(await tail.arrayBuffer());
  }

  const meta = new TextEncoder().encode(`${file.size}:${file.name}:${file.lastModified}`);
  const combined = new Uint8Array(parts.reduce((sum, p) => sum + p.byteLength, 0) + meta.byteLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }
  combined.set(meta, offset);

  const hash = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readElementMetadata(
  element: HTMLVideoElement | HTMLAudioElement,
): { duration?: number; width?: number; height?: number } {
  const duration = Number.isFinite(element.duration) ? element.duration : undefined;
  if (element instanceof HTMLVideoElement) {
    return {
      duration,
      width: element.videoWidth || undefined,
      height: element.videoHeight || undefined,
    };
  }
  return { duration };
}

async function extractMediaMetadataInner(
  file: File,
  kind: MediaKind,
): Promise<{ duration?: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file);

  return new Promise((resolve) => {
    const cleanup = (result: { duration?: number; width?: number; height?: number }) => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
      element.load();
      resolve(result);
    };

    const element: HTMLVideoElement | HTMLAudioElement =
      kind === 'video' ? document.createElement('video') : document.createElement('audio');

    element.preload = 'metadata';
    element.muted = true;
    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
    }

    element.onloadedmetadata = () => cleanup(readElementMetadata(element));
    element.onerror = () => cleanup({});
    element.onstalled = () => cleanup({});

    element.src = url;
    element.load();
  });
}

export async function extractMediaMetadata(
  file: File,
  kind: MediaKind,
): Promise<{ duration?: number; width?: number; height?: number }> {
  try {
    return await withTimeout(
      extractMediaMetadataInner(file, kind),
      METADATA_TIMEOUT_MS,
      {},
    );
  } catch {
    return {};
  }
}

/** Content-hash only files that share a byte size with at least one other file. */
export async function refineDuplicateFingerprints(
  files: MediaFileRecord[],
  getFile: (record: MediaFileRecord) => Promise<File>,
  onProgress?: (message: string) => void,
  onFingerprintUpdated?: (record: MediaFileRecord) => Promise<void>,
): Promise<number> {
  const bySize = new Map<number, MediaFileRecord[]>();
  for (const file of files) {
    const group = bySize.get(file.size) ?? [];
    group.push(file);
    bySize.set(file.size, group);
  }

  const candidates = [...bySize.values()].filter((g) => g.length > 1).flat();
  if (candidates.length === 0) return 0;

  for (let i = 0; i < candidates.length; i++) {
    const record = candidates[i];
    onProgress?.(`Checking duplicates ${i + 1}/${candidates.length}: ${record.name}`);
    try {
      const file = await getFile(record);
      record.fingerprint = await computeFileFingerprint(file);
      await onFingerprintUpdated?.(record);
    } catch {
      // Keep quick fingerprint on read/hash failure
    }
    await yieldToMain();
  }

  return candidates.length;
}

export function findDuplicateGroups(files: MediaFileRecord[]): DuplicateGroup[] {
  const byFingerprint = new Map<string, MediaFileRecord[]>();
  for (const file of files) {
    if (!file.fingerprint) continue;
    const group = byFingerprint.get(file.fingerprint) ?? [];
    group.push(file);
    byFingerprint.set(file.fingerprint, group);
  }

  return Array.from(byFingerprint.entries())
    .filter(([, group]) => group.length > 1)
    .map(([fingerprint, group]) => ({
      fingerprint,
      files: group.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
      wastedBytes: group.slice(1).reduce((sum, f) => sum + f.size, 0),
    }))
    .sort((a, b) => b.wastedBytes - a.wastedBytes);
}

export function buildFolderProfiles(files: MediaFileRecord[]): FolderProfile[] {
  const map = new Map<string, FolderProfile>();

  for (const file of files) {
    const parts = file.relativePath.split('/');
    const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
    const existing = map.get(folderPath) ?? {
      folderPath,
      fileCount: 0,
      videoCount: 0,
      audioCount: 0,
      totalBytes: 0,
      suggestedDestination: '',
    };
    existing.fileCount += 1;
    existing.totalBytes += file.size;
    if (file.kind === 'video') existing.videoCount += 1;
    else existing.audioCount += 1;
    map.set(folderPath, existing);
  }

  for (const profile of map.values()) {
    if (profile.videoCount > 0 && profile.audioCount === 0) {
      profile.suggestedDestination = `Videos/${profile.folderPath === '(root)' ? 'Unsorted' : profile.folderPath}`;
    } else if (profile.audioCount > 0 && profile.videoCount === 0) {
      profile.suggestedDestination = `Music/${profile.folderPath === '(root)' ? 'Unsorted' : profile.folderPath}`;
    } else {
      profile.suggestedDestination = `Media/${profile.folderPath === '(root)' ? 'Mixed' : profile.folderPath}`;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
}

export async function getFileByRelativePath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File> {
  const parts = relativePath.split('/');
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}
