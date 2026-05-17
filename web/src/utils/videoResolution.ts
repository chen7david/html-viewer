import type { MediaFileRecord } from '../types/Media';

/**
 * Maps pixel dimensions to standard quality labels (Plex/Jellyfin-style).
 * Uses the shorter side as the "p" reference so portrait and landscape match industry labels.
 */
export function getResolutionLabel(width?: number, height?: number): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;

  const shortSide = Math.min(width, height);

  if (shortSide >= 4320) return '8K';
  if (shortSide >= 2160) return '4K';
  if (shortSide >= 1440) return '1440p';
  if (shortSide >= 1080) return '1080p';
  if (shortSide >= 720) return '720p';
  if (shortSide >= 576) return '576p';
  if (shortSide >= 480) return '480p';
  if (shortSide >= 360) return '360p';
  if (shortSide >= 240) return '240p';
  return `${shortSide}p`;
}

export function formatResolutionDisplay(
  record: { kind: string; width?: number; height?: number; resolutionLabel?: string },
): string {
  if (record.kind !== 'video') return '—';
  if (record.resolutionLabel) return record.resolutionLabel;
  const label = getResolutionLabel(record.width, record.height);
  if (label) return label;
  if (record.width && record.height) return `${record.width}×${record.height}`;
  return '—';
}

/** Ant Design Tag colors per quality tier */
export const RESOLUTION_TAG_COLORS: Record<string, string> = {
  '8K': 'magenta',
  '4K': 'gold',
  '1440p': 'cyan',
  '1080p': 'blue',
  '720p': 'green',
  '576p': 'lime',
  '480p': 'orange',
  '360p': 'volcano',
  '240p': 'red',
};

const RESOLUTION_RANK: Record<string, number> = {
  '8K': 90,
  '4K': 80,
  '1440p': 70,
  '1080p': 60,
  '720p': 50,
  '576p': 40,
  '480p': 30,
  '360p': 20,
  '240p': 10,
};

export function getResolutionTagColor(label: string): string {
  return RESOLUTION_TAG_COLORS[label] ?? 'default';
}

export function getResolutionRank(record: {
  resolutionLabel?: string;
  width?: number;
  height?: number;
}): number {
  const label = record.resolutionLabel ?? getResolutionLabel(record.width, record.height);
  if (label && RESOLUTION_RANK[label] !== undefined) return RESOLUTION_RANK[label];
  const pixels = (record.width ?? 0) * (record.height ?? 0);
  if (pixels > 0) return Math.min(99, Math.floor(pixels / 100_000));
  return 0;
}

/** Higher rank = better quality (for duplicate keeper selection). */
export function compareByResolutionDesc(a: MediaFileRecord, b: MediaFileRecord): number {
  const rankDiff = getResolutionRank(b) - getResolutionRank(a);
  if (rankDiff !== 0) return rankDiff;
  const pixelsA = (a.width ?? 0) * (a.height ?? 0);
  const pixelsB = (b.width ?? 0) * (b.height ?? 0);
  if (pixelsB !== pixelsA) return pixelsB - pixelsA;
  if (b.size !== a.size) return b.size - a.size;
  return a.relativePath.localeCompare(b.relativePath);
}

export const RESOLUTION_FILTER_OPTIONS = [
  '8K',
  '4K',
  '1440p',
  '1080p',
  '720p',
  '576p',
  '480p',
  '360p',
  '240p',
] as const;
