import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { MediaFileRecord } from '../../types/Media';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { formatDuration } from '../../utils/mediaExtensions';
import { getMediaDisplayName } from '../../utils/mediaDisplayName';
import { cacheMediaWatchSeed } from '../../utils/mediaWatchSeed';
import { formatResolutionDisplay } from '../../utils/videoResolution';
import MediaEditMetadataModal from './MediaEditMetadataModal';
import MediaVideoActions from './MediaVideoActions';
import MediaVideoCardMenu from './MediaVideoCardMenu';
import MediaVideoDetailsModal from './MediaVideoDetailsModal';
import MediaVideoThumbnail from './MediaVideoThumbnail';

interface MediaVideoCardProps {
  video: MediaFileRecord;
  directoryHandle: FileSystemDirectoryHandle | null;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  compact?: boolean;
  facetTags?: string[];
  onVideoUpdated?: (video: MediaFileRecord) => void;
  onVideoRemoved?: (videoId: string) => void;
  showEdit?: boolean;
  openInNewTab?: boolean;
  /** Dense grid card for browse page. */
  variant?: 'default' | 'browse';
}

const CLICK_MOVE_THRESHOLD_PX = 6;

export default function MediaVideoCard({
  video,
  directoryHandle,
  resolveFile,
  compact = false,
  facetTags = [],
  onVideoUpdated,
  onVideoRemoved,
  showEdit = !compact,
  openInNewTab = false,
  variant = 'default',
}: MediaVideoCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { scan } = useMediaApp();
  const [editOpen, setEditOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [current, setCurrent] = useState(video);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didScrubRef = useRef(false);

  const isBrowse = variant === 'browse';

  useEffect(() => {
    setCurrent(video);
  }, [video]);

  const displayName = getMediaDisplayName(current);
  const resolutionLabel = formatResolutionDisplay(current);

  const watchUrl = `/media/watch/${current.id}?from=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  const openWatch = () => {
    cacheMediaWatchSeed(current);
    if (openInNewTab) {
      window.open(watchUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (location.pathname.startsWith('/media/watch/')) {
      navigate(watchUrl, { replace: true, state: { video: current } });
      return;
    }
    navigate(watchUrl, { state: { video: current } });
  };

  const handleSaved = (updated: MediaFileRecord) => {
    setCurrent(updated);
    onVideoUpdated?.(updated);
  };

  const handleCardClick = () => {
    if (didScrubRef.current) {
      didScrubRef.current = false;
      return;
    }
    openWatch();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    didScrubRef.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || !isBrowse) return;
    const moved =
      Math.abs(e.clientX - start.x) > CLICK_MOVE_THRESHOLD_PX ||
      Math.abs(e.clientY - start.y) > CLICK_MOVE_THRESHOLD_PX;
    if (moved) didScrubRef.current = true;
  };

  if (isBrowse) {
    return (
      <>
        <article
          className="group flex flex-col gap-1.5"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div
            className="relative aspect-video rounded-md overflow-hidden bg-zinc-900 cursor-pointer ring-1 ring-black/10 dark:ring-white/10 group-hover:ring-orange-500/60 transition-shadow"
            onClick={handleCardClick}
            onAuxClick={(e) => {
              if (e.button === 1) window.open(watchUrl, '_blank', 'noopener,noreferrer');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openWatch()}
          >
            {directoryHandle ? (
              <MediaVideoThumbnail
                media={current}
                resolveFile={resolveFile}
                scrubPreview
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-2 text-center">
                Reconnect folder
              </div>
            )}

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />

            {resolutionLabel !== '—' && (
              <span className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-black/70 text-white pointer-events-none">
                {resolutionLabel}
              </span>
            )}
            <span className="absolute bottom-8 right-1.5 z-20 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums bg-black/70 text-white pointer-events-none">
              {formatDuration(current.duration)}
            </span>

            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
              <Tooltip title="Video details">
                <button
                  type="button"
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-black/55 text-white hover:bg-black/75"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpen(true);
                  }}
                  aria-label="Video details"
                >
                  <InfoCircleOutlined className="text-sm" />
                </button>
              </Tooltip>
              <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <MediaVideoCardMenu
                  video={current}
                  onEdit={() => setEditOpen(true)}
                  onShowInfo={() => setInfoOpen(true)}
                  onDeleted={() => onVideoRemoved?.(current.id)}
                />
              </div>
            </div>

          </div>

          <div className="min-w-0 px-0.5">
            <h3
              className="text-xs font-medium text-gray-900 dark:text-gray-100 m-0 line-clamp-2 leading-snug cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              title={displayName}
              onClick={(e) => {
                e.stopPropagation();
                openWatch();
              }}
            >
              {displayName}
            </h3>
            <div
              className="mt-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MediaVideoActions
                video={current}
                compact
                starSize="small"
                onUpdated={(updated) => {
                  setCurrent(updated);
                  onVideoUpdated?.(updated);
                }}
              />
            </div>
          </div>
        </article>

        <MediaEditMetadataModal
          open={editOpen}
          file={current}
          scanId={scan?.id}
          facetTags={facetTags}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
        <MediaVideoDetailsModal open={infoOpen} video={current} onClose={() => setInfoOpen(false)} />
      </>
    );
  }

  return (
    <>
      <article
        className="group cursor-pointer h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition-all"
        onClick={openWatch}
        onAuxClick={(e) => {
          if (e.button === 1) window.open(watchUrl, '_blank', 'noopener,noreferrer');
        }}
        onKeyDown={(e) => e.key === 'Enter' && openWatch()}
        role="button"
        tabIndex={0}
      >
        <div className="relative aspect-video w-full shrink-0 bg-gray-900 overflow-hidden">
          {directoryHandle ? (
            <MediaVideoThumbnail
              media={current}
              resolveFile={resolveFile}
              hoverPreview={!compact}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 px-2 text-center">
              Reconnect folder
            </div>
          )}
        </div>

        <div className={`flex flex-col flex-1 min-h-0 ${compact ? 'p-2 gap-1' : 'p-3 gap-1.5'}`}>
          <h3
            className={`font-semibold text-gray-900 dark:text-gray-100 m-0 overflow-hidden ${
              compact
                ? 'text-xs line-clamp-2 leading-4 min-h-[2rem] max-h-[2rem]'
                : 'text-sm line-clamp-2 leading-5 min-h-[2.5rem] max-h-[2.5rem]'
            }`}
          >
            {displayName}
          </h3>
          <div className={compact ? 'h-6 shrink-0 flex items-center' : 'h-8 shrink-0 flex items-center'}>
            <MediaVideoActions
              video={current}
              compact={compact}
              onUpdated={(updated) => {
                setCurrent(updated);
                onVideoUpdated?.(updated);
              }}
            />
          </div>
        </div>
      </article>

      {showEdit && (
        <MediaEditMetadataModal
          open={editOpen}
          file={current}
          scanId={scan?.id}
          facetTags={facetTags}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
