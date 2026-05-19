import { getExtension } from './mediaExtensions';
import { DELETED_FOLDER, UPLOADS_FOLDER, verifyDirectoryPermission } from './mediaScanner';

export { UPLOADS_FOLDER };

export async function ensureWritePermission(
  root: FileSystemDirectoryHandle,
): Promise<boolean> {
  return verifyDirectoryPermission(root, 'readwrite');
}

async function ensureDirectoryPath(
  root: FileSystemDirectoryHandle,
  pathParts: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of pathParts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir;
}

/** Move a file into `_deleted/<original relative path>` at the library root. */
export async function moveFileToDeletedFolder(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<string> {
  const parts = relativePath.split('/');
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid file path.');

  let srcDir = root;
  for (const part of parts) {
    srcDir = await srcDir.getDirectoryHandle(part);
  }
  const fileHandle = await srcDir.getFileHandle(fileName);

  const deletedRoot = await root.getDirectoryHandle(DELETED_FOLDER, { create: true });
  const destDir = parts.length > 0 ? await ensureDirectoryPath(deletedRoot, parts) : deletedRoot;

  await fileHandle.move(destDir, fileName);
  return `${DELETED_FOLDER}/${relativePath}`;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned || 'upload';
}

async function resolveUniqueFileName(
  dir: FileSystemDirectoryHandle,
  desiredName: string,
): Promise<string> {
  const ext = getExtension(desiredName);
  const dotExt = ext ? `.${ext}` : '';
  const base =
    ext && desiredName.toLowerCase().endsWith(dotExt)
      ? desiredName.slice(0, -dotExt.length)
      : desiredName;

  let candidate = sanitizeFileName(desiredName);
  let n = 1;
  while (true) {
    try {
      await dir.getFileHandle(candidate);
      candidate = sanitizeFileName(`${base}-${n}${dotExt}`);
      n += 1;
    } catch (err) {
      if ((err as DOMException).name === 'NotFoundError') return candidate;
      throw err;
    }
  }
}

/** Write a file into `uploads/` at the library root (creates folder if needed). */
export async function writeUploadedMediaFile(
  root: FileSystemDirectoryHandle,
  file: File,
  preferredName?: string,
): Promise<{ relativePath: string; fileName: string }> {
  const canWrite = await ensureWritePermission(root);
  if (!canWrite) {
    throw new Error('Write permission is required to upload. Reconnect the folder and allow editing.');
  }
  if (file.size === 0) {
    throw new Error('Empty files cannot be uploaded.');
  }

  const uploadsDir = await root.getDirectoryHandle(UPLOADS_FOLDER, { create: true });
  const fileName = await resolveUniqueFileName(uploadsDir, preferredName ?? file.name);
  const handle = await uploadsDir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();

  return { relativePath: `${UPLOADS_FOLDER}/${fileName}`, fileName };
}
