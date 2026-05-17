import { Tag } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { formatResolutionDisplay, getResolutionTagColor } from '../../utils/videoResolution';

interface ResolutionBadgeProps {
  media: MediaFileRecord;
  className?: string;
}

export default function ResolutionBadge({ media, className = '' }: ResolutionBadgeProps) {
  const label = formatResolutionDisplay(media);
  if (label === '—') return null;

  return (
    <Tag color={getResolutionTagColor(label)} className={`m-0 font-semibold ${className}`}>
      {label}
    </Tag>
  );
}
