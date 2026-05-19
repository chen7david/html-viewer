import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import type { MediaFileRecord } from '../../types/Media';
import { formatDuration } from '../../utils/mediaExtensions';
import { captureVideoPoster } from '../../utils/videoPosterCapture';
import {
  getCachedPoster,
  isPosterFailed,
  markPosterFailed,
  setCachedPoster,
} from '../../utils/videoPosterCache';
import {
  acquireScrubBlob,
  getScrubBlob,
  releaseScrubBlob,
  retainScrubBlob,
} from '../../utils/videoScrubCache';
import { withThumbnailSlot } from '../../utils/videoThumbnailQueue';

function defaultSeekTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.5;
  return duration > 1 ? Math.min(2, duration * 0.05) : 0.5;
}

interface MediaVideoThumbnailProps {
  media: MediaFileRecord;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  className?: string;
  hoverPreview?: boolean;
  scrubPreview?: boolean;
}

export default function MediaVideoThumbnail({
  media,
  resolveFile,
  className = '',
  hoverPreview = false,
  scrubPreview = false,
}: MediaVideoThumbnailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubLoadingRef = useRef(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(() => getCachedPoster(media.id) ?? null);
  const [scrubBlobUrl, setScrubBlobUrl] = useState<string | null>(null);
  const [scrubReady, setScrubReady] = useState(false);
  const [failed, setFailed] = useState(() => isPosterFailed(media.id));
  const [posterLoading, setPosterLoading] = useState(
    () => !getCachedPoster(media.id) && !isPosterFailed(media.id),
  );
  const [scrubLoading, setScrubLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState(0);

  const previewMode = scrubPreview || hoverPreview;
  const showScrubVideo = Boolean(scrubBlobUrl && (scrubPreview ? isHovering : true));

  useEffect(() => {
    setPosterUrl(getCachedPoster(media.id) ?? null);
    setScrubBlobUrl(null);
    setScrubReady(false);
    setFailed(isPosterFailed(media.id));
    setPosterLoading(!getCachedPoster(media.id) && !isPosterFailed(media.id));
    setScrubLoading(false);
    setIsHovering(false);
    setScrubRatio(null);
  }, [media.id]);

  // Static poster only (small JPEG) when card scrolls into view — no full-file blob kept.
  useEffect(() => {
    if (posterUrl || failed || getCachedPoster(media.id)) {
      if (!posterUrl && getCachedPoster(media.id)) {
        setPosterUrl(getCachedPoster(media.id) ?? null);
      }
      setPosterLoading(false);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        observer.disconnect();
        void loadPoster();
      },
      { rootMargin: '60px' },
    );
    observer.observe(root);

    async function loadPoster() {
      setPosterLoading(true);
      try {
        const dataUrl = await withThumbnailSlot(async () => {
          const file = await resolveFile(media);
          return captureVideoPoster(file);
        });
        if (cancelled) return;
        setCachedPoster(media.id, dataUrl);
        setPosterUrl(dataUrl);
      } catch {
        if (!cancelled) {
          markPosterFailed(media.id);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setPosterLoading(false);
      }
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [media, resolveFile, posterUrl, failed]);

  const loadScrubBlob = useCallback(async () => {
    const cached = getScrubBlob(media.id);
    if (scrubLoadingRef.current || scrubBlobUrl || cached) {
      if (!scrubBlobUrl && cached) {
        retainScrubBlob(media.id);
        setScrubBlobUrl(cached);
      }
      return;
    }
    scrubLoadingRef.current = true;
    setScrubLoading(true);
    try {
      const url = await withThumbnailSlot(async () => {
        const file = await resolveFile(media);
        return URL.createObjectURL(file);
      });
      acquireScrubBlob(media.id, url);
      setScrubBlobUrl(url);
    } catch {
      markPosterFailed(media.id);
      setFailed(true);
    } finally {
      scrubLoadingRef.current = false;
      setScrubLoading(false);
    }
  }, [media, resolveFile, scrubBlobUrl]);

  const unloadScrubBlob = useCallback(() => {
    setScrubBlobUrl(null);
    setScrubReady(false);
    releaseScrubBlob(media.id);
  }, [media.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !scrubBlobUrl || !showScrubVideo) return;

    const onSeeked = () => setScrubReady(true);
    const onLoadedMetadata = () => {
      video.currentTime = defaultSeekTime(video.duration);
    };
    const onError = () => {
      setScrubReady(false);
      unloadScrubBlob();
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
  }, [scrubBlobUrl, showScrubVideo, unloadScrubBlob]);

  const seekToRatio = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const time = clamped * video.duration;
    setScrubRatio(clamped);
    setScrubTime(time);
    if (Math.abs(video.currentTime - time) < 0.05) return;
    video.pause();
    video.currentTime = time;
  }, []);

  const resetScrub = useCallback(() => {
    const video = videoRef.current;
    setIsHovering(false);
    setScrubRatio(null);
    if (video && Number.isFinite(video.duration)) {
      video.pause();
      video.currentTime = defaultSeekTime(video.duration);
    }
    if (scrubPreview) {
      unloadScrubBlob();
    }
  }, [scrubPreview, unloadScrubBlob]);

  const handlePointerEnter = () => {
    if (failed) return;
    setIsHovering(true);
    if (scrubPreview) {
      void loadScrubBlob();
      return;
    }
    if (!hoverPreview) return;
    void loadScrubBlob().then(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!scrubPreview || !scrubReady || failed) return;
    if (!scrubBlobUrl) {
      void loadScrubBlob();
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    seekToRatio((e.clientX - rect.left) / rect.width);
  };

  const handlePointerLeave = () => {
    if (!previewMode) return;
    resetScrub();
  };

  const handleScrubBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!scrubPreview || !scrubReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    seekToRatio((e.clientX - rect.left) / rect.width);
  };

  const showScrubUi = scrubPreview && isHovering && scrubRatio !== null && scrubReady;
  const isLoading =
    posterLoading || scrubLoading || (showScrubVideo && Boolean(scrubBlobUrl) && !scrubReady);
  const showFailedIcon = failed && !isLoading;

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden bg-zinc-900 flex items-center justify-center select-none ${className}`}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {posterUrl && !showScrubVideo && (
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {showScrubVideo && scrubBlobUrl && (
        <video
          ref={videoRef}
          src={scrubBlobUrl}
          muted
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
            scrubReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80">
          <Spin indicator={<LoadingOutlined className="text-white text-2xl" spin />} />
        </div>
      )}

      {showFailedIcon && (
        <VideoCameraOutlined className="text-3xl text-violet-400/60 z-10" aria-label="Preview unavailable" />
      )}

      {showScrubUi && (
        <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none">
          <div className="px-2 pb-1.5 pt-6 bg-gradient-to-t from-black/85 to-transparent">
            <p className="text-[10px] text-white/90 font-medium tabular-nums mb-1">
              {formatDuration(scrubTime)}
              {media.duration != null && media.duration > 0 && (
                <span className="text-white/50"> / {formatDuration(media.duration)}</span>
              )}
            </p>
            <div
              className="h-1 rounded-full bg-white/25 overflow-hidden pointer-events-auto cursor-pointer"
              onClick={handleScrubBarClick}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((scrubRatio ?? 0) * 100)}
              aria-label="Preview position"
            >
              <div
                className="h-full bg-orange-500 rounded-full transition-[width] duration-75"
                style={{ width: `${(scrubRatio ?? 0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
