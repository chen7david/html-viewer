/** Small JPEG posters (data URLs) — no full-file blob kept in memory. */

const POSTER_CACHE = new Map<string, string>();
const POSTER_FAIL = new Set<string>();
const MAX_POSTERS = 200;

export function getCachedPoster(id: string): string | undefined {
  return POSTER_CACHE.get(id);
}

export function isPosterFailed(id: string): boolean {
  return POSTER_FAIL.has(id);
}

export function markPosterFailed(id: string): void {
  POSTER_FAIL.add(id);
}

export function setCachedPoster(id: string, dataUrl: string): void {
  if (POSTER_CACHE.has(id)) POSTER_CACHE.delete(id);
  POSTER_CACHE.set(id, dataUrl);
  while (POSTER_CACHE.size > MAX_POSTERS) {
    const oldest = POSTER_CACHE.keys().next().value as string | undefined;
    if (!oldest) break;
    POSTER_CACHE.delete(oldest);
  }
}
