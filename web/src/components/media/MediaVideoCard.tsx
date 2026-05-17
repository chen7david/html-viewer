import { EditOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { MediaFileRecord } from '../../types/Media';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { formatDuration } from '../../utils/mediaExtensions';
import { formatMediaExtensionLine, getMediaDisplayName } from '../../utils/mediaDisplayName';
import MediaEditMetadataModal from './MediaEditMetadataModal';
import MediaVideoActions from './MediaVideoActions';
import ResolutionBadge from './ResolutionBadge';
import MediaVideoThumbnail from './MediaVideoThumbnail';

interface MediaVideoCardProps {
  video: MediaFileRecord;
  directoryHandle: FileSystemDirectoryHandle | null;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  compact?: boolean;
  facetTags?: string[];
  onVideoUpdated?: (video: MediaFileRecord) => void;
  /** Show edit control on the card (browse page) */
  showEdit?: boolean;
}

const TITLE_TOOLTIP = (displayName: string, fileName: string, path: string) => (
  <div className="max-w-xs">
    <div className="font-medium">{displayName}</div>
    <div className="text-xs opacity-80 mt-1 font-mono">{fileName}</div>
    <div className="text-xs opacity-70 mt-0.5 truncate">{path}</div>
  </div>
);

export default function MediaVideoCard({
  video,
  directoryHandle,
  resolveFile,
  compact = false,
  facetTags = [],
  onVideoUpdated,
  showEdit = !compact,
}: MediaVideoCardProps) {
  const navigate = useNavigate();
  const { scan } = useMediaApp();
  const [editOpen, setEditOpen] = useState(false);
  const [current, setCurrent] = useState(video);

  useEffect(() => {
    setCurrent(video);
  }, [video]);

  const displayName = getMediaDisplayName(current);
  const extensionLine = formatMediaExtensionLine(current);
  const userTags = current.userTags ?? [];
  const tooltipContent = TITLE_TOOLTIP(displayName, current.name, current.relativePath);

  const openWatch = () => navigate(`/media/watch/${current.id}`);

  const handleSaved = (updated: MediaFileRecord) => {
    setCurrent(updated);
    onVideoUpdated?.(updated);
  };

  return (
    <>
      <article
        className="group cursor-pointer h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition-all"
        onClick={openWatch}
        onKeyDown={(e) => e.key === 'Enter' && openWatch()}
        role="button"
        tabIndex={0}
      >
        <div className="relative aspect-video w-full shrink-0 bg-gray-900 overflow-hidden">
          {directoryHandle ? (
            <MediaVideoThumbnail
              media={current}
              resolveFile={resolveFile}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 px-2 text-center">
              Reconnect folder
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center pointer-events-none">
            <PlayCircleOutlined className="text-5xl text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all drop-shadow-lg" />
          </div>
          <div className="absolute top-2 right-2 z-20 pointer-events-none">
            <ResolutionBadge media={current} />
          </div>
          <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-white font-medium tabular-nums pointer-events-none">
            {formatDuration(current.duration)}
          </div>
          {showEdit && (
            <Tooltip title="Edit name & tags">
              <Button
                type="default"
                size="small"
                icon={<EditOutlined />}
                className="absolute top-2 left-2 z-20 shadow-sm bg-white/95 dark:bg-gray-800/95"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                aria-label="Edit metadata"
              />
            </Tooltip>
          )}
        </div>

        <div className={`flex flex-col flex-1 min-h-0 ${compact ? 'p-2 gap-1' : 'p-3 gap-1.5'}`}>
          <Tooltip title={tooltipContent} placement="topLeft" mouseEnterDelay={0.4}>
            <h3
              className={`font-semibold text-gray-900 dark:text-gray-100 m-0 overflow-hidden ${
                compact
                  ? 'text-xs line-clamp-2 leading-4 min-h-[2rem] max-h-[2rem]'
                  : 'text-sm line-clamp-2 leading-5 min-h-[2.5rem] max-h-[2.5rem]'
              }`}
            >
              {displayName}
            </h3>
          </Tooltip>

          {!compact && (
            <>
              <p
                className="text-[11px] text-gray-400 font-mono h-4 leading-4 truncate m-0 shrink-0"
                title={extensionLine ? `${extensionLine} · ${current.name}` : current.name}
              >
                {extensionLine || '\u00A0'}
              </p>

              <div className="h-5 shrink-0 overflow-hidden flex items-center gap-1 flex-nowrap">
                {userTags.length > 0 ? (
                  <>
                    {userTags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 truncate max-w-[72px] shrink-0"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                    {userTags.length > 3 && (
                      <span className="text-[10px] text-gray-400 shrink-0">+{userTags.length - 3}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-transparent select-none" aria-hidden>
                    —
                  </span>
                )}
              </div>

              <div className="h-8 shrink-0 flex items-center">
                <MediaVideoActions
                  video={current}
                  compact={false}
                  onUpdated={(updated) => {
                    setCurrent(updated);
                    onVideoUpdated?.(updated);
                  }}
                />
              </div>

              <Tooltip title={current.relativePath} placement="bottom">
                <p className="text-[11px] text-gray-400 truncate h-4 leading-4 m-0 mt-auto shrink-0">
                  {current.relativePath}
                </p>
              </Tooltip>
            </>
          )}

          {compact && (
            <div className="h-6 shrink-0 flex items-center">
              <MediaVideoActions
                video={current}
                compact
                onUpdated={(updated) => {
                  setCurrent(updated);
                  onVideoUpdated?.(updated);
                }}
              />
            </div>
          )}
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
    </>
  );
}
