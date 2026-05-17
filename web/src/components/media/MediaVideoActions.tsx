import { message } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { MediaLibraryService } from '../../services/media';
import MediaPlaylistPicker from './MediaPlaylistPicker';
import MediaStarRating from './MediaStarRating';

interface MediaVideoActionsProps {
  video: MediaFileRecord;
  onUpdated?: (video: MediaFileRecord) => void;
  layout?: 'row' | 'stack';
  starSize?: 'small' | 'default';
  /** Hide playlist button on compact related-video cards */
  compact?: boolean;
}

export default function MediaVideoActions({
  video,
  onUpdated,
  layout = 'row',
  starSize = 'small',
  compact = false,
}: MediaVideoActionsProps) {
  const { scan } = useMediaApp();

  const handleRating = async (rating: number | undefined) => {
    if (!scan?.id) {
      message.info('Scan a media folder first.');
      return;
    }
    try {
      const updated = await MediaLibraryService.updateRating(scan.id, video.id, rating ?? null);
      onUpdated?.(updated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not save rating');
    }
  };

  return (
    <div
      className={
        layout === 'row'
          ? 'flex flex-wrap items-center justify-between gap-2'
          : 'flex flex-col gap-2'
      }
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MediaStarRating value={video.rating} onChange={handleRating} size={starSize} />
      {!compact && <MediaPlaylistPicker video={video} />}
    </div>
  );
}
