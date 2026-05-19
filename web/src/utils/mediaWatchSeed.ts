import type { MediaFileRecord } from '../types/Media';

const SEED_PREFIX = 'media-watch-seed:';

export function cacheMediaWatchSeed(video: MediaFileRecord): void {
  try {
    sessionStorage.setItem(`${SEED_PREFIX}${video.id}`, JSON.stringify(video));
  } catch {
    // Quota or private mode — watch page will fall back to IndexedDB lookup.
  }
}

export function clearMediaWatchSeed(mediaId: string): void {
  try {
    sessionStorage.removeItem(`${SEED_PREFIX}${mediaId}`);
  } catch {
    // ignore
  }
}

export function readMediaWatchSeed(mediaId: string): MediaFileRecord | undefined {
  try {
    const raw = sessionStorage.getItem(`${SEED_PREFIX}${mediaId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as MediaFileRecord;
    return parsed?.id === mediaId ? parsed : undefined;
  } catch {
    return undefined;
  }
}
