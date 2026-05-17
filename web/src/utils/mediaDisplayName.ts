import type { MediaFileRecord } from '../types/Media';

/** User-facing title without file extension. */
export function getMediaDisplayName(file: MediaFileRecord): string {
  const custom = file.displayName?.trim();
  if (custom) return custom;
  const dot = file.name.lastIndexOf('.');
  if (dot > 0) return file.name.slice(0, dot);
  return file.name;
}

/** Original extension for conversion / renaming reference. */
export function getMediaFileExtension(file: MediaFileRecord): string {
  if (file.extension) return file.extension;
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 ? file.name.slice(dot + 1) : '';
}

export function formatMediaExtensionLine(file: MediaFileRecord): string {
  const ext = getMediaFileExtension(file);
  return ext ? `.${ext}` : '';
}
