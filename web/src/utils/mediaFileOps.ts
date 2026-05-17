import { DELETED_FOLDER, verifyDirectoryPermission } from './mediaScanner';

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
