import { useEffect, useState } from 'react';
import { Input, Modal, Select, message } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { MediaLibraryService } from '../../services/media';
import {
  formatMediaExtensionLine,
  getMediaDisplayName,
  getMediaFileExtension,
} from '../../utils/mediaDisplayName';

interface MediaEditMetadataModalProps {
  open: boolean;
  file: MediaFileRecord | null;
  scanId: string | undefined;
  facetTags?: string[];
  onClose: () => void;
  onSaved: (updated: MediaFileRecord) => void;
}

export default function MediaEditMetadataModal({
  open,
  file,
  scanId,
  facetTags = [],
  onClose,
  onSaved,
}: MediaEditMetadataModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [userTags, setUserTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file || !open) return;
    setDisplayName(getMediaDisplayName(file));
    setUserTags(file.userTags ?? []);
  }, [file, open]);

  const handleSave = async () => {
    if (!scanId || !file) return;
    setSaving(true);
    try {
      const updated = await MediaLibraryService.updateFileMetadata(scanId, file.id, {
        displayName,
        userTags,
      });
      message.success('Saved metadata.');
      onSaved(updated);
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not save metadata.');
    } finally {
      setSaving(false);
    }
  };

  const extension = file ? formatMediaExtensionLine(file) : '';
  const originalName = file?.name ?? '';

  return (
    <Modal
      title="Edit video info"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="Save"
      destroyOnClose
    >
      {file && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Display name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={getMediaDisplayName(file)}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              File on disk: <span className="font-mono">{originalName}</span>
            </p>
            {extension && (
              <p className="text-xs text-gray-500 mt-0.5">
                Format: <span className="font-mono">{extension}</span>
                {getMediaFileExtension(file) && (
                  <span className="ml-1 text-gray-400">(for conversion / export)</span>
                )}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <Select
              mode="tags"
              className="w-full"
              placeholder="Add tags…"
              value={userTags}
              onChange={setUserTags}
              options={facetTags.map((t) => ({ value: t, label: t }))}
              tokenSeparators={[',']}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Auto tags from folders and filenames are kept; these are extra tags you add.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
