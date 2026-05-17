import type { MediaFileRecord, MediaKind } from '../types/Media';
import { getResolutionLabel } from './videoResolution';

/** Build searchable tags from folder path, type, extension, and quality. */
export function deriveMediaTags(
  relativePath: string,
  kind: MediaKind,
  width?: number,
  height?: number,
  resolutionLabel?: string,
  extraTags: string[] = [],
): string[] {
  const tags = new Set<string>();

  const parts = relativePath.split('/').slice(0, -1);
  for (const part of parts) {
    const normalized = part.trim().toLowerCase();
    if (normalized) tags.add(normalized);
  }

  const fileName = relativePath.split('/').pop() ?? '';
  const baseName = fileName.replace(/\.[^.]+$/, '');
  for (const token of baseName.split(/[._\-\s]+/)) {
    const t = token.trim().toLowerCase();
    if (t.length >= 2) tags.add(t);
  }

  tags.add(kind);
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext) tags.add(ext);

  const quality = resolutionLabel ?? getResolutionLabel(width, height);
  if (quality) tags.add(quality.toLowerCase());

  for (const t of extraTags) {
    const normalized = t.trim().toLowerCase();
    if (normalized) tags.add(normalized);
  }

  return [...tags].sort();
}

export function applyMediaTags(file: MediaFileRecord): MediaFileRecord {
  const resolutionLabel =
    file.resolutionLabel ?? getResolutionLabel(file.width, file.height);
  const userTags = (file.userTags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const derived = deriveMediaTags(
    file.relativePath,
    file.kind,
    file.width,
    file.height,
    resolutionLabel,
    [],
  );
  const tags = [...new Set([...derived, ...userTags])].sort();
  return { ...file, resolutionLabel, userTags, tags };
}

export function fileMatchesTags(file: MediaFileRecord, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  const fileTags = new Set((file.tags ?? []).map((t) => t.toLowerCase()));
  return selectedTags.every((t) => fileTags.has(t.toLowerCase()));
}
