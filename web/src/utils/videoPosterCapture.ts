import { METADATA_TIMEOUT_MS } from './mediaScanner';

function waitVideoEvent(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Could not decode video frame'));
    };
    const cleanup = () => {
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener(event, onOk, { once: true });
    video.addEventListener('error', onErr, { once: true });
  });
}

/** Decode one frame, return a small JPEG data URL, then release the blob immediately. */
export async function captureVideoPoster(file: File, seekSeconds?: number): Promise<string> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.src = url;

  try {
    await Promise.race([
      waitVideoEvent(video, 'loadedmetadata'),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('metadata timeout')), METADATA_TIMEOUT_MS);
      }),
    ]);
    const duration = video.duration;
    const seekTo =
      seekSeconds ??
      (Number.isFinite(duration) && duration > 1 ? Math.min(2, duration * 0.05) : 0.5);
    video.currentTime = seekTo;
    await Promise.race([
      waitVideoEvent(video, 'seeked'),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('seek timeout')), METADATA_TIMEOUT_MS);
      }),
    ]);

    const thumbWidth = 320;
    const thumbHeight = Math.max(
      1,
      Math.round((thumbWidth * video.videoHeight) / Math.max(video.videoWidth, 1)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
