import { useEffect, useRef, type CSSProperties } from 'react';
import { MediaCommunitySkin, MediaOutlet, MediaPlayer } from '@vidstack/react';
import 'vidstack/styles/base.css';
import 'vidstack/styles/defaults.css';
import 'vidstack/styles/community-skin/video.css';
import 'vidstack/styles/community-skin/audio.css';

interface MediaVideoPlayerProps {
  src: string;
  title: string;
  kind: 'video' | 'audio';
  /** YouTube-style constrained 16:9 player on watch page */
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
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onEnded) return;
    const video = shellRef.current?.querySelector('video');
    if (!video) return;
    const handleEnded = () => onEnded();
    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [src, onEnded]);

  return (
    <div className={className}>
      {!isWatch && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate font-medium">{title}</p>
      )}
      <div
        ref={shellRef}
        className={`media-player-shell flex items-center justify-center bg-black overflow-hidden ${
          isWatch ? 'w-full aspect-video rounded-xl max-w-4xl mx-auto' : 'w-full rounded-lg'
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
        <MediaPlayer
          src={src}
          title={title}
          autoplay
          playsInline
          className="media-player-contain w-full h-full"
          style={{ '--media-brand': '#7c3aed' } as CSSProperties}
        >
          <MediaOutlet />
          <MediaCommunitySkin />
        </MediaPlayer>
      </div>
    </div>
  );
}
