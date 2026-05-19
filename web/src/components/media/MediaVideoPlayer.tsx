import { useEffect, useRef, type CSSProperties } from 'react';

interface MediaVideoPlayerProps {
  src: string;
  mimeType?: string;
  title: string;
  kind: 'video' | 'audio';
  layout?: 'watch' | 'default';
  className?: string;
  onEnded?: () => void;
}

export default function MediaVideoPlayer({
  src,
  title,
  kind,
  layout = 'default',
  className = '',
  onEnded,
}: MediaVideoPlayerProps) {
  const isWatch = layout === 'watch' && kind === 'video';
  const mediaRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !onEnded) return;
    const handleEnded = () => onEnded();
    el.addEventListener('ended', handleEnded);
    return () => el.removeEventListener('ended', handleEnded);
  }, [src, onEnded]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => {
      // Autoplay may be blocked; native controls remain available.
    });
  }, [src]);

  return (
    <div className={className}>
      {!isWatch && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate font-medium">{title}</p>
      )}
      <div
        className={`media-player-shell overflow-hidden bg-black ${
          isWatch ? 'media-player-watch aspect-video rounded-xl' : 'w-full rounded-lg'
        }`}
        style={
          isWatch
            ? undefined
            : ({
                maxHeight: 'min(75dvh, calc(100dvh - 14rem))',
                aspectRatio: '16 / 9',
              } as CSSProperties)
        }
      >
        {kind === 'video' ? (
          <video
            key={src}
            ref={mediaRef}
            src={src}
            controls
            controlsList="nodownload"
            playsInline
            preload="auto"
            className="w-full h-full min-h-[200px] object-contain bg-black"
            title={title}
          />
        ) : (
          <audio
            key={src}
            src={src}
            controls
            preload="auto"
            className="w-full m-4"
            title={title}
            onEnded={onEnded}
          />
        )}
      </div>
    </div>
  );
}
