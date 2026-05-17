import { DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { formatDuration } from '../../utils/mediaExtensions';
import { getMediaDisplayName } from '../../utils/mediaDisplayName';
import MediaStarRating from './MediaStarRating';
import MediaVideoThumbnail from './MediaVideoThumbnail';
import ResolutionBadge from './ResolutionBadge';

interface MediaPlaylistTrackRowProps {
  video: MediaFileRecord;
  index: number;
  directoryHandle: FileSystemDirectoryHandle | null;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  active?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onRating?: (rating: number | undefined) => void;
  showRemove?: boolean;
}

export default function MediaPlaylistTrackRow({
  video,
  index,
  directoryHandle,
  resolveFile,
  active = false,
  onPlay,
  onRemove,
  onRating,
  showRemove = true,
}: MediaPlaylistTrackRowProps) {
  const displayName = getMediaDisplayName(video);

  return (
    <article
      className={`flex gap-3 p-2 rounded-xl transition-colors cursor-pointer group ${
        active
          ? 'bg-violet-100 dark:bg-violet-900/40 ring-1 ring-violet-400 dark:ring-violet-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
      onClick={onPlay}
      onKeyDown={(e) => e.key === 'Enter' && onPlay?.()}
      role="button"
      tabIndex={0}
    >
      <span className="w-6 shrink-0 text-sm text-gray-400 font-medium pt-8 text-center tabular-nums">
        {index + 1}
      </span>

      <div className="relative w-[168px] shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-900">
        {directoryHandle ? (
          <MediaVideoThumbnail media={video} resolveFile={resolveFile} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-1 text-center">
            Reconnect folder
          </div>
        )}
        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[10px] text-white font-medium tabular-nums pointer-events-none">
          {formatDuration(video.duration)}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors pointer-events-none">
          <PlayCircleOutlined className="text-3xl text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
      </div>

      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug mb-1">
          {displayName}
        </h3>
        <p className="text-[11px] text-gray-500 truncate mb-2" title={video.relativePath}>
          {video.relativePath}
        </p>
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ResolutionBadge media={video} />
          {onRating && <MediaStarRating value={video.rating} onChange={onRating} />}
        </div>
      </div>

      <div
        className="flex flex-col gap-1 shrink-0 pt-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {onPlay && (
          <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={onPlay}>
            Play
          </Button>
        )}
        {showRemove && onRemove && (
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </article>
  );
}
