import { useCallback, useMemo, useState } from 'react';
import { CloudUploadOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Progress, Select, Upload, message } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { MediaLibraryService } from '../../services/media';
import { classifyMediaFile, formatBytes, getExtension } from '../../utils/mediaExtensions';
import { UPLOADS_FOLDER } from '../../utils/mediaScanner';

function titleFromFileName(name: string): string {
  const ext = getExtension(name);
  if (!ext) return name.replace(/[-_]+/g, ' ').trim();
  const base = name.slice(0, -(ext.length + 1));
  return base.replace(/[-_]+/g, ' ').trim() || name;
}

type QueueItem = {
  key: string;
  file: File;
  displayName: string;
  userTags: string[];
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

const ACCEPT =
  'video/*,audio/*,.mp4,.webm,.mkv,.mov,.m4v,.avi,.wmv,.flv,.mpeg,.mpg,.3gp,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus';

interface MediaUploadModalProps {
  open: boolean;
  facetTags?: string[];
  onClose: () => void;
  onUploaded?: () => void;
}

export default function MediaUploadModal({
  open,
  facetTags = [],
  onClose,
  onUploaded,
}: MediaUploadModalProps) {
  const { scan, directoryHandle, reload } = useMediaApp();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const reset = useCallback(() => {
    setQueue([]);
    setUploading(false);
  }, []);

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const addFiles = (files: File[]) => {
    const valid: QueueItem[] = [];
    for (const file of files) {
      if (file.size === 0) {
        message.warning(`Skipped empty file: ${file.name}`);
        continue;
      }
      if (!classifyMediaFile(file.name)) {
        message.warning(`Unsupported type: ${file.name}`);
        continue;
      }
      valid.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        displayName: titleFromFileName(file.name),
        userTags: [],
        status: 'pending',
        progress: 0,
      });
    }
    if (valid.length === 0) return;
    setQueue((prev) => [...prev, ...valid]);
  };

  const updateItem = (key: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeItem = (key: string) => {
    setQueue((prev) => prev.filter((item) => item.key !== key));
  };

  const pendingCount = useMemo(() => queue.filter((q) => q.status === 'pending').length, [queue]);
  const doneCount = useMemo(() => queue.filter((q) => q.status === 'done').length, [queue]);

  const handleUploadAll = async () => {
    if (!scan?.id || !directoryHandle) {
      message.info('Connect a media folder with write access before uploading.');
      return;
    }
    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'error');
    if (pending.length === 0) {
      message.info('Add videos to upload.');
      return;
    }

    setUploading(true);
    let succeeded = 0;

    for (const item of pending) {
      updateItem(item.key, { status: 'uploading', progress: 15, error: undefined });
      try {
        await MediaLibraryService.importUploadedFile(scan.id, directoryHandle, item.file, {
          displayName: item.displayName,
          userTags: item.userTags,
        });
        updateItem(item.key, { status: 'done', progress: 100 });
        succeeded += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        updateItem(item.key, { status: 'error', progress: 0, error: msg });
        message.error(`${item.file.name}: ${msg}`);
      }
    }

    setUploading(false);
    if (succeeded > 0) {
      await reload();
      onUploaded?.();
      message.success(
        succeeded === 1 ? 'Video uploaded to your library.' : `${succeeded} videos uploaded.`,
      );
    }
  };

  const uploadProps = {
    multiple: true,
    accept: ACCEPT,
    showUploadList: false,
    beforeUpload: (file: RcFile) => {
      addFiles([file]);
      return false;
    },
  };

  return (
    <Modal
      title="Upload videos"
      open={open}
      onCancel={handleClose}
      width={640}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={uploading}>
          {doneCount > 0 && pendingCount === 0 ? 'Close' : 'Cancel'}
        </Button>,
        <Button
          key="upload"
          type="primary"
          icon={<CloudUploadOutlined />}
          loading={uploading}
          disabled={!scan || !directoryHandle || queue.length === 0}
          onClick={handleUploadAll}
        >
          {uploading ? 'Uploading…' : `Upload${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
        </Button>,
      ]}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Files are saved to <code className="text-xs">{UPLOADS_FOLDER}/</code> in your library folder.
        Set a title and tags before uploading — the same pattern used on major video platforms.
      </p>

      <Upload.Dragger {...uploadProps} disabled={uploading} className="mb-4">
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Drag videos here or click to browse</p>
        <p className="ant-upload-hint text-xs">MP4, WebM, MKV, MOV, and other common formats · empty files are rejected</p>
      </Upload.Dragger>

      {queue.length > 0 && (
        <ul className="space-y-3 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
          {queue.map((item) => (
            <li
              key={item.key}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/50 dark:bg-gray-800/40"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate m-0">{item.file.name}</p>
                  <p className="text-xs text-gray-500 m-0">{formatBytes(item.file.size)}</p>
                </div>
                {item.status === 'pending' && !uploading && (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Remove"
                    onClick={() => removeItem(item.key)}
                  />
                )}
                {item.status === 'done' && (
                  <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Uploaded</span>
                )}
              </div>

              {item.status !== 'done' && (
                <>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Title
                  </label>
                  <Input
                    size="small"
                    value={item.displayName}
                    disabled={uploading || item.status === 'uploading'}
                    onChange={(e) => updateItem(item.key, { displayName: e.target.value })}
                    className="mb-2"
                    placeholder="Display name"
                  />
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Tags
                  </label>
                  <Select
                    mode="tags"
                    size="small"
                    className="w-full"
                    placeholder="Add tags…"
                    value={item.userTags}
                    disabled={uploading || item.status === 'uploading'}
                    onChange={(tags) => updateItem(item.key, { userTags: tags })}
                    options={facetTags.map((t) => ({ value: t, label: t }))}
                    tokenSeparators={[',']}
                  />
                </>
              )}

              {(item.status === 'uploading' || item.status === 'done') && (
                <Progress
                  percent={item.progress}
                  size="small"
                  status={item.status === 'done' ? 'success' : 'active'}
                  className="mt-2 mb-0"
                />
              )}
              {item.status === 'error' && item.error && (
                <p className="text-xs text-red-500 mt-2 mb-0">{item.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
