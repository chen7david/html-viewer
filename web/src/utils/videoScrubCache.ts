/** Short-lived full-file blobs only while scrubbing (max 2 at a time). */

const SCRUB_CACHE = new Map<string, string>();
const SCRUB_REFS = new Map<string, number>();
const MAX_SCRUB_BLOBS = 2;

export function getScrubBlob(id: string): string | undefined {
  return SCRUB_CACHE.get(id);
}

export function retainScrubBlob(id: string): void {
  if (!SCRUB_CACHE.has(id)) return;
  SCRUB_REFS.set(id, (SCRUB_REFS.get(id) ?? 0) + 1);
}

export function acquireScrubBlob(id: string, url: string): void {
  const existing = SCRUB_CACHE.get(id);
  if (existing && existing !== url) {
    releaseScrubBlob(id);
    URL.revokeObjectURL(existing);
  }

  SCRUB_REFS.set(id, (SCRUB_REFS.get(id) ?? 0) + 1);
  if (SCRUB_CACHE.has(id)) SCRUB_CACHE.delete(id);
  SCRUB_CACHE.set(id, url);

  while (SCRUB_CACHE.size > MAX_SCRUB_BLOBS) {
    evictOldestScrub();
  }
}

export function releaseScrubBlob(id: string): void {
  const refs = (SCRUB_REFS.get(id) ?? 1) - 1;
  if (refs <= 0) {
    SCRUB_REFS.delete(id);
    const url = SCRUB_CACHE.get(id);
    SCRUB_CACHE.delete(id);
    if (url) URL.revokeObjectURL(url);
  } else {
    SCRUB_REFS.set(id, refs);
  }
}

function evictOldestScrub(): void {
  const oldest = SCRUB_CACHE.keys().next().value as string | undefined;
  if (!oldest) return;
  const url = SCRUB_CACHE.get(oldest);
  SCRUB_CACHE.delete(oldest);
  SCRUB_REFS.delete(oldest);
  if (url) URL.revokeObjectURL(url);
}
