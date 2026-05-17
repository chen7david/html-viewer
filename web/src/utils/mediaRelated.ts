import type { MediaFileRecord } from '../types/Media';

export function getRelatedVideos(
  current: MediaFileRecord,
  candidates: MediaFileRecord[],
  limit = 12,
): MediaFileRecord[] {
  const folderParts = current.relativePath.split('/');
  const parentFolder = folderParts.length > 1 ? folderParts.slice(0, -1).join('/') : '';
  const tagSet = new Set(current.tags ?? []);

  const scored = candidates
    .filter((v) => v.id !== current.id && v.kind === 'video')
    .map((v) => {
      let score = 0;
      if (parentFolder) {
        const vFolder = v.relativePath.split('/').slice(0, -1).join('/');
        if (vFolder === parentFolder) score += 5;
        else if (v.relativePath.startsWith(`${parentFolder}/`)) score += 3;
      }
      for (const t of v.tags ?? []) {
        if (tagSet.has(t)) score += 1;
      }
      if (current.resolutionLabel && v.resolutionLabel === current.resolutionLabel) score += 2;
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.v.name.localeCompare(b.v.name));

  if (scored.length >= limit) return scored.slice(0, limit).map((s) => s.v);

  const filler = candidates
    .filter((v) => v.id !== current.id && v.kind === 'video' && !scored.some((s) => s.v.id === v.id))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return [...scored.map((s) => s.v), ...filler].slice(0, limit);
}
