/** Star rating scale stored on each media file (1–5). */
export const MEDIA_RATING_MIN = 1;
export const MEDIA_RATING_MAX = 5;

export function clampMediaRating(value: number): number {
  return Math.min(MEDIA_RATING_MAX, Math.max(MEDIA_RATING_MIN, Math.round(value)));
}

export function isValidMediaRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MEDIA_RATING_MIN &&
    value <= MEDIA_RATING_MAX
  );
}
