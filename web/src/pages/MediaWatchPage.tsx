import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Alert, Button, Space, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined, StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons';
import MediaEditMetadataModal from '../components/media/MediaEditMetadataModal';
import MediaPlaylistTrackRow from '../components/media/MediaPlaylistTrackRow';
import MediaVideoCard from '../components/media/MediaVideoCard';
import MediaVideoPlayer from '../components/media/MediaVideoPlayer';
import MediaVideoActions from '../components/media/MediaVideoActions';
import ResolutionBadge from '../components/media/ResolutionBadge';
import { useMediaApp } from '../contexts/MediaAppContext';
import { MediaLibraryService } from '../services/media';
import type { MediaFileRecord } from '../types/Media';
import { formatBytes, formatDuration } from '../utils/mediaExtensions';
import {
  formatMediaExtensionLine,
  getMediaDisplayName,
} from '../utils/mediaDisplayName';
import { getRelatedVideos } from '../utils/mediaRelated';
import { readMediaWatchSeed } from '../utils/mediaWatchSeed';

export default function MediaWatchPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const [searchParams] = useSearchParams();
  const playlistId = searchParams.get('playlist');
  const from = searchParams.get('from');
  const navigate = useNavigate();
  const location = useLocation();
  const { scan, directoryHandle, playlists, resolveFile, isLoading: appLoading } = useMediaApp();

  const [media, setMedia] = useState<MediaFileRecord | null>(null);
  const [related, setRelated] = useState<MediaFileRecord[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<MediaFileRecord[]>([]);
  const [facetTags, setFacetTags] = useState<string[]>([]);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const playerUrlRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const playlist = useMemo(
    () => (playlistId ? playlists.find((p) => p.id === playlistId) : undefined),
    [playlistId, playlists],
  );

  const playlistIndex = useMemo(
    () => (mediaId ? playlistTracks.findIndex((t) => t.id === mediaId) : -1),
    [playlistTracks, mediaId],
  );

  const inPlaylistMode = Boolean(playlistId && playlist);

  const playPlaylistVideo = useCallback(
    (id: string) => {
      const qs = playlistId ? `?playlist=${playlistId}` : '';
      navigate(`/media/watch/${id}${qs}`, { replace: true });
    },
    [navigate, playlistId],
  );

  const playNext = useCallback(() => {
    if (playlistIndex < 0 || playlistIndex >= playlistTracks.length - 1) return;
    playPlaylistVideo(playlistTracks[playlistIndex + 1].id);
  }, [playlistIndex, playlistTracks, playPlaylistVideo]);

  const playPrevious = useCallback(() => {
    if (playlistIndex <= 0) return;
    playPlaylistVideo(playlistTracks[playlistIndex - 1].id);
  }, [playlistIndex, playlistTracks, playPlaylistVideo]);

  useEffect(() => {
    return () => {
      if (playerUrlRef.current) {
        URL.revokeObjectURL(playerUrlRef.current);
        playerUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!scan?.id || !playlistId || !playlist) {
      setPlaylistTracks([]);
      return;
    }
    MediaLibraryService.getPlaylistTracks(scan.id, playlist.mediaIds).then(setPlaylistTracks);
  }, [scan?.id, playlistId, playlist]);

  // Load player when video id or folder access changes. Generation guard avoids stale async updates.
  useEffect(() => {
    if (appLoading) return;

    if (!mediaId) {
      setPlayerLoading(false);
      setMedia(null);
      setPlayerUrl(null);
      setError('Missing video id.');
      return;
    }

    const generation = ++loadGenerationRef.current;
    const isCurrent = () => generation === loadGenerationRef.current;

    const navState = location.state as { video?: MediaFileRecord } | null;
    const seedVideo =
      navState?.video?.id === mediaId ? navState.video : readMediaWatchSeed(mediaId);

    async function loadPlayer() {
      setPlayerLoading(true);
      setError(null);

      try {
        let record =
          seedVideo ?? (await MediaLibraryService.getFileById(mediaId!));
        if (!record && scan?.id) {
          record = await MediaLibraryService.getVideoById(scan.id, mediaId!);
        }
        if (!isCurrent()) return;

        if (!record) {
          setMedia(null);
          setPlayerUrl(null);
          setError('Video not found in your library.');
          return;
        }

        if (!directoryHandle) {
          setMedia(record);
          setPlayerUrl(null);
          setError('Reconnect your folder from the Media hub to play this file.');
          return;
        }

        const file = await resolveFile(record);
        if (!isCurrent()) return;

        const url = URL.createObjectURL(file);
        if (!isCurrent()) {
          URL.revokeObjectURL(url);
          return;
        }

        const previous = playerUrlRef.current;
        playerUrlRef.current = url;
        setMedia(record);
        setPlayerUrl(url);
        if (previous && previous !== url) {
          URL.revokeObjectURL(previous);
        }
      } catch (err) {
        if (isCurrent()) {
          setError(err instanceof Error ? err.message : 'Could not load video.');
          setPlayerUrl(null);
        }
      } finally {
        if (isCurrent()) setPlayerLoading(false);
      }
    }

    void loadPlayer();
    // resolveFile identity is stable enough via directoryHandle
  }, [appLoading, scan?.id, mediaId, directoryHandle, location.state]);

  // Related videos + facets (does not touch the player blob URL).
  useEffect(() => {
    if (!scan?.id || !mediaId || !media) return;

    let cancelled = false;

    async function loadRelated() {
      const scanId = scan!.id;
      if (!media) return;
      const [allVideos, facets] = await Promise.all([
        MediaLibraryService.getAllVideos(scanId),
        MediaLibraryService.getBrowseFacets(scanId, 'video'),
      ]);
      if (cancelled) return;
      if (!playlistId) {
        setRelated(getRelatedVideos(media, allVideos, 12));
      } else {
        setRelated([]);
      }
      setFacetTags(facets.tags);
    }

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [scan?.id, mediaId, media, playlistId]);

  const handlePlaylistRating = async (video: MediaFileRecord, rating: number | undefined) => {
    if (!scan?.id) return;
    const updated = await MediaLibraryService.updateRating(scan.id, video.id, rating ?? null);
    setPlaylistTracks((prev) => prev.map((v) => (v.id === video.id ? updated : v)));
    if (video.id === mediaId) setMedia(updated);
  };

  if (appLoading || (playerLoading && !media && !playerUrl)) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Alert type="error" message={error ?? 'Video not found'} showIcon className="mb-4" />
        <Link to="/media/browse">
          <Button icon={<ArrowLeftOutlined />}>Back to browse</Button>
        </Link>
      </div>
    );
  }

  const displayName = getMediaDisplayName(media);
  const extensionLine = formatMediaExtensionLine(media);
  const hasNext = inPlaylistMode && playlistIndex >= 0 && playlistIndex < playlistTracks.length - 1;
  const hasPrev = inPlaylistMode && playlistIndex > 0;
  const browseBackTarget = from && from.startsWith('/media/browse') ? from : '/media/browse';

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {inPlaylistMode ? (
          <Link to={`/media/playlists?id=${playlistId}`}>
            <Button icon={<ArrowLeftOutlined />}>Playlist</Button>
          </Link>
        ) : (
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(browseBackTarget)}>
            Browse
          </Button>
        )}
        {inPlaylistMode && (
          <Space wrap>
            <Button icon={<StepBackwardOutlined />} disabled={!hasPrev} onClick={playPrevious}>
              Previous
            </Button>
            <Button icon={<StepForwardOutlined />} disabled={!hasNext} onClick={playNext}>
              Next
            </Button>
            <span className="text-sm text-gray-500">
              {playlistIndex + 1} / {playlistTracks.length}
              {playlist?.name ? ` · ${playlist.name}` : ''}
            </span>
          </Space>
        )}
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6">
        <div>
          <div className="relative mb-3 max-w-4xl mx-auto">
            {playerLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 aspect-video">
                <Spin size="large" />
              </div>
            )}
            {playerUrl ? (
              <MediaVideoPlayer
                key={`${media.id}-${playerUrl}`}
                src={playerUrl}
                mimeType={media.mimeType}
                title={displayName}
                kind={media.kind}
                layout="watch"
                onEnded={inPlaylistMode && hasNext ? playNext : undefined}
              />
            ) : (
              <div className="aspect-video rounded-xl bg-black flex items-center justify-center text-gray-400 text-sm px-4 text-center">
                {error ?? 'Video unavailable'}
              </div>
            )}
          </div>

          <header className="mb-6 max-w-4xl">
            <div className="flex flex-wrap items-start gap-2 justify-between">
              <h1 className="text-lg md:text-xl font-bold m-0 line-clamp-2 flex-1">{displayName}</h1>
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                Edit info
              </Button>
            </div>
            {extensionLine && (
              <p className="text-sm text-gray-400 font-mono mt-1">
                {extensionLine}
                <span className="text-gray-500 font-sans ml-2">· on disk: {media.name}</span>
              </p>
            )}
            {(media.userTags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(media.userTags ?? []).map((tag) => (
                  <Tag key={tag} color="purple">
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap items-center gap-2">
              <ResolutionBadge media={media} />
              <span>{formatDuration(media.duration)} · {formatBytes(media.size)}</span>
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <MediaVideoActions video={media} starSize="default" layout="row" onUpdated={setMedia} />
            </div>
          </header>

          {error && !playerUrl && (
            <Alert type="warning" message={error} showIcon className="mb-4 max-w-4xl" />
          )}

          {!inPlaylistMode && (
            <section className="mt-2 max-w-4xl">
              <h2 className="text-lg font-semibold mb-4">Related videos</h2>
              {related.length === 0 ? (
                <p className="text-gray-500 text-sm">No related videos found in this folder.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-4">
                  {related.map((video) => (
                    <MediaVideoCard
                      key={video.id}
                      variant="browse"
                      video={video}
                      directoryHandle={directoryHandle}
                      resolveFile={resolveFile}
                      facetTags={facetTags}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {inPlaylistMode && playlistTracks.length > 0 && (
          <aside className="xl:sticky xl:top-4 xl:self-start rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 max-h-[calc(100dvh-6rem)] overflow-y-auto">
            <h2 className="text-base font-semibold mb-3 px-1">{playlist?.name ?? 'Playlist'}</h2>
            <div className="space-y-1">
              {playlistTracks.map((video, index) => (
                <MediaPlaylistTrackRow
                  key={video.id}
                  video={video}
                  index={index}
                  directoryHandle={directoryHandle}
                  resolveFile={resolveFile}
                  active={video.id === mediaId}
                  showRemove={false}
                  onPlay={() => playPlaylistVideo(video.id)}
                  onRating={(r) => handlePlaylistRating(video, r)}
                />
              ))}
            </div>
          </aside>
        )}
      </div>

      <MediaEditMetadataModal
        open={editOpen}
        file={media}
        scanId={scan?.id}
        facetTags={facetTags}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setMedia(updated)}
      />
    </div>
  );
}
