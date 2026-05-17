const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mkv', 'avi', 'wmv', 'flv', 'mpeg', 'mpg', '3gp',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'wma', 'opus', 'aiff', 'aif', 'weba',
]);

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'audio/ogg',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wma: 'audio/x-ms-wma',
  opus: 'audio/opus',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  weba: 'audio/webm',
};

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function classifyMediaFile(filename: string): { kind: 'video' | 'audio'; extension: string; mimeType: string } | null {
  const extension = getExtension(filename);
  if (VIDEO_EXTENSIONS.has(extension)) {
    return { kind: 'video', extension, mimeType: MIME_BY_EXT[extension] ?? `video/${extension}` };
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return { kind: 'audio', extension, mimeType: MIME_BY_EXT[extension] ?? `audio/${extension}` };
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || Number.isNaN(seconds) || !Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
