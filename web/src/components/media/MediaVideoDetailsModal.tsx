import { Modal, Tag } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { formatBytes, formatDuration } from '../../utils/mediaExtensions';
import {
  formatMediaExtensionLine,
  getMediaDisplayName,
} from '../../utils/mediaDisplayName';
import ResolutionBadge from './ResolutionBadge';
import MediaStarRating from './MediaStarRating';

interface MediaVideoDetailsModalProps {
  open: boolean;
  video: MediaFileRecord | null;
  onClose: () => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt className="text-gray-500 dark:text-gray-400 m-0">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 m-0 break-words">{children}</dd>
    </div>
  );
}

export default function MediaVideoDetailsModal({ open, video, onClose }: MediaVideoDetailsModalProps) {
  if (!video) {
    return (
      <Modal title="Video details" open={open} onCancel={onClose} footer={null} destroyOnClose>
        {null}
      </Modal>
    );
  }

  const displayName = getMediaDisplayName(video);
  const extensionLine = formatMediaExtensionLine(video);
  const allTags = [...(video.tags ?? []), ...(video.userTags ?? [])].filter(
    (t, i, arr) => arr.indexOf(t) === i,
  );

  return (
    <Modal title="Video details" open={open} onCancel={onClose} footer={null} destroyOnClose width={520}>
      <dl className="space-y-3 m-0">
        <DetailRow label="Title">{displayName}</DetailRow>
        <DetailRow label="File name">
          <span className="font-mono text-xs">{video.name}</span>
        </DetailRow>
        {extensionLine && <DetailRow label="Format">{extensionLine}</DetailRow>}
        <DetailRow label="Path">
          <span className="font-mono text-xs">{video.relativePath}</span>
        </DetailRow>
        <DetailRow label="Duration">{formatDuration(video.duration)}</DetailRow>
        <DetailRow label="Size">{formatBytes(video.size)}</DetailRow>
        {video.kind === 'video' && (
          <DetailRow label="Quality">
            <ResolutionBadge media={video} />
          </DetailRow>
        )}
        <DetailRow label="Rating">
          <MediaStarRating value={video.rating} disabled size="small" onChange={() => undefined} />
        </DetailRow>
        {allTags.length > 0 && (
          <DetailRow label="Tags">
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <Tag key={tag} className="m-0">
                  {tag}
                </Tag>
              ))}
            </div>
          </DetailRow>
        )}
      </dl>
    </Modal>
  );
}
