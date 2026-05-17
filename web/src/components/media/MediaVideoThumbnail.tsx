import { useEffect, useRef, useState } from 'react';
import { VideoCameraOutlined } from '@ant-design/icons';
import type { MediaFileRecord } from '../../types/Media';
import { withThumbnailSlot } from '../../utils/videoThumbnailQueue';

const THUMB_CACHE = new Map<string, string>();
const THUMB_FAIL = new Set<string>();

interface MediaVideoThumbnailProps {
  media: MediaFileRecord;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  className?: string;
}

/**
 * Shows a real frame from the video without saving image files to disk.
 * The browser decodes one frame into a hidden <video>, then we display it (or a canvas-free video poster).
 */
export default function MediaVideoThumbnail({
  media,
  resolveFile,
  className = '',
}: MediaVideoThumbnailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => THUMB_CACHE.get(media.id) ?? null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => THUMB_FAIL.has(media.id));

  useEffect(() => {
    setReady(false);
    setFailed(THUMB_FAIL.has(media.id));
    setBlobUrl(THUMB_CACHE.get(media.id) ?? null);
  }, [media.id]);

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
        THUMB_CACHE.set(media.id, url);
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

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', () => {
      THUMB_FAIL.add(media.id);
      setFailed(true);
    });

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [blobUrl, media.id]);

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden bg-gray-900 flex items-center justify-center ${className}`}
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
