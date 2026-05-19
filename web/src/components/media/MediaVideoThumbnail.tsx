import { useEffect, useRef, useState } from 'react';
import { VideoCameraOutlined } from '@ant-design/icons';
import type { MediaFileRecord } from '../../types/Media';
import { withThumbnailSlot } from '../../utils/videoThumbnailQueue';

const THUMB_CACHE = new Map<string, string>();
const THUMB_FAIL = new Set<string>();
const MAX_THUMB_CACHE_ITEMS = 120;

function addThumbToCache(id: string, url: string) {
  const existing = THUMB_CACHE.get(id);
  if (existing && existing !== url) {
    URL.revokeObjectURL(existing);
  }

  if (THUMB_CACHE.has(id)) {
    THUMB_CACHE.delete(id);
  }
  THUMB_CACHE.set(id, url);

  while (THUMB_CACHE.size > MAX_THUMB_CACHE_ITEMS) {
    const oldestKey = THUMB_CACHE.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldestUrl = THUMB_CACHE.get(oldestKey);
    THUMB_CACHE.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
}

interface MediaVideoThumbnailProps {
  media: MediaFileRecord;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  className?: string;
  hoverPreview?: boolean;
}

/**
 * Shows a real frame from the video without saving image files to disk.
 * The browser decodes one frame into a hidden <video>, then we display it (or a canvas-free video poster).
 */
export default function MediaVideoThumbnail({
  media,
  resolveFile,
  className = '',
  hoverPreview = false,
}: MediaVideoThumbnailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => THUMB_CACHE.get(media.id) ?? null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => THUMB_FAIL.has(media.id));

  useEffect(() => {
    if (blobUrl || failed || THUMB_CACHE.has(media.id)) return;

    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        observer.disconnect();
        void loadPreview();
      },
      { rootMargin: '120px' },
    );
    observer.observe(root);

    async function loadPreview() {
      try {
        const url = await withThumbnailSlot(async () => {
          const file = await resolveFile(media);
          return URL.createObjectURL(file);
        });
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        addThumbToCache(media.id, url);
        setBlobUrl(url);
      } catch {
        if (!cancelled) {
          THUMB_FAIL.add(media.id);
          setFailed(true);
        }
      }
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [media, resolveFile, blobUrl, failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !blobUrl) return;

    const onSeeked = () => setReady(true);
    const onLoadedMetadata = () => {
      const seekTo = Number.isFinite(video.duration) && video.duration > 1 ? Math.min(2, video.duration * 0.05) : 0.5;
      video.currentTime = seekTo;
    };
    const onError = () => {
      THUMB_FAIL.add(media.id);
      setFailed(true);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
  }, [blobUrl, media.id]);

  const handleMouseEnter = () => {
    if (!hoverPreview) return;
    const video = videoRef.current;
    if (!video || !ready || failed) return;
    video.muted = true;
    void video.play().catch(() => {
      // Ignore autoplay restrictions and keep static thumbnail fallback.
    });
  };

  const handleMouseLeave = () => {
    if (!hoverPreview) return;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const seekTo = Number.isFinite(video.duration) && video.duration > 1 ? Math.min(2, video.duration * 0.05) : 0.5;
    video.currentTime = seekTo;
  };

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden bg-gray-900 flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!failed && blobUrl ? (
        <video
          ref={videoRef}
          src={blobUrl}
          muted
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
      {(!ready || failed) && (
        <VideoCameraOutlined className="text-4xl text-violet-400/70 z-10" />
      )}
    </div>
  );
}
