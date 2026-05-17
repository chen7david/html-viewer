import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import MediaPlaylistTrackRow from '../components/media/MediaPlaylistTrackRow';
import MediaStarRating from '../components/media/MediaStarRating';
import ResolutionBadge from '../components/media/ResolutionBadge';
import MediaVideoThumbnail from '../components/media/MediaVideoThumbnail';
import { useMediaApp } from '../contexts/MediaAppContext';
import { MediaLibraryService, MediaPlaylistService } from '../services/media';
import type { MediaFileRecord, MediaPlaylist } from '../types/Media';
import { getMediaDisplayName } from '../utils/mediaDisplayName';

export default function MediaPlaylistsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { scan, playlists, directoryHandle, isLoading, reload, resolveFile } = useMediaApp();

  const selectedId = searchParams.get('id') ?? playlists[0]?.id ?? null;

  const [tracks, setTracks] = useState<MediaFileRecord[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const [allVideos, setAllVideos] = useState<MediaFileRecord[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const selected = useMemo(
    () => playlists.find((p) => p.id === selectedId) ?? null,
    [playlists, selectedId],
  );

  const selectPlaylist = (id: string) => {
    setSearchParams({ id });
  };

  const loadTracks = useCallback(async () => {
    if (!scan?.id || !selected) {
      setTracks([]);
      return;
    }
    setTracksLoading(true);
    try {
      const rows = await MediaLibraryService.getPlaylistTracks(scan.id, selected.mediaIds);
      setTracks(rows);
    } finally {
      setTracksLoading(false);
    }
  }, [scan?.id, selected]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const loadVideosForPicker = useCallback(async () => {
    if (!scan?.id) return;
    setVideosLoading(true);
    try {
      const videos = await MediaLibraryService.getAllVideos(scan.id);
      setAllVideos(videos);
    } finally {
      setVideosLoading(false);
    }
  }, [scan?.id]);

  useEffect(() => {
    if (addDrawerOpen) void loadVideosForPicker();
  }, [addDrawerOpen, loadVideosForPicker]);

  const filteredPickerVideos = useMemo(() => {
    const q = videoSearch.trim().toLowerCase();
    if (!q) return allVideos;
    return allVideos.filter(
      (v) =>
        getMediaDisplayName(v).toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.relativePath.toLowerCase().includes(q),
    );
  }, [allVideos, videoSearch]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      message.warning('Enter a playlist name.');
      return;
    }
    setCreating(true);
    try {
      const playlist = await MediaPlaylistService.create(newPlaylistName.trim(), []);
      message.success('Playlist created.');
      setNewPlaylistName('');
      await reload();
      selectPlaylist(playlist.id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlist: MediaPlaylist) => {
    await MediaPlaylistService.delete(playlist.id);
    message.success('Playlist deleted.');
    await reload();
    if (selectedId === playlist.id) {
      setSearchParams({});
    }
  };

  const handleToggleVideo = async (videoId: string) => {
    if (!selected) return;
    try {
      await MediaPlaylistService.toggleMedia(selected.id, videoId);
      await reload();
      await loadTracks();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not update playlist');
    }
  };

  const handleRating = async (video: MediaFileRecord, rating: number | undefined) => {
    if (!scan?.id) return;
    try {
      await MediaLibraryService.updateRating(scan.id, video.id, rating ?? null);
      await loadTracks();
      if (addDrawerOpen) {
        setAllVideos((prev) =>
          prev.map((v) => (v.id === video.id ? { ...v, rating } : v)),
        );
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not save rating');
    }
  };

  const playPlaylist = () => {
    if (tracks.length === 0) {
      message.info('Add videos to this playlist first.');
      return;
    }
    if (!directoryHandle) {
      message.info('Reconnect your media folder from the Media hub to play videos.');
      return;
    }
    navigate(`/media/watch/${tracks[0].id}?playlist=${selected!.id}`);
  };

  const playTrack = (video: MediaFileRecord) => {
    if (!directoryHandle) {
      message.info('Reconnect your media folder to play videos.');
      return;
    }
    navigate(`/media/watch/${video.id}?playlist=${selected!.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <Empty description="Pick a media folder from the Media hub first." />
        <Link to="/media" className="mt-4 inline-block">
          <Button type="primary">Go to Media hub</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link to="/media">
          <Button icon={<ArrowLeftOutlined />}>Media hub</Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3 rounded-xl text-white">
            <UnorderedListOutlined className="text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold m-0">Playlists</h1>
            <p className="text-gray-500 dark:text-gray-400 m-0 text-sm">
              Create playlists and add videos from your library
            </p>
          </div>
        </div>
        <Link to="/media/browse" className="ml-auto">
          <Button>Browse videos</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 h-fit">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your playlists
          </h2>
          <Space.Compact className="w-full mb-4">
            <Input
              placeholder="New playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onPressEnter={handleCreatePlaylist}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={creating}
              onClick={handleCreatePlaylist}
            />
          </Space.Compact>

          {playlists.length === 0 ? (
            <p className="text-sm text-gray-500">No playlists yet. Create one above.</p>
          ) : (
            <div className="space-y-1">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                    p.id === selectedId
                      ? 'bg-violet-100 dark:bg-violet-900/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => selectPlaylist(p.id)}
                >
                  <div className="flex justify-between gap-2 min-w-0">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{p.mediaIds.length}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6 min-h-[320px]">
          {!selected ? (
            <Empty description="Select or create a playlist" className="py-16" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-bold m-0">{selected.name}</h2>
                  <p className="text-sm text-gray-500 m-0 mt-1">
                    {tracks.length} video{tracks.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Space wrap>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    className="bg-violet-600"
                    disabled={tracks.length === 0}
                    onClick={playPlaylist}
                  >
                    Play playlist
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={() => setAddDrawerOpen(true)}>
                    Add videos
                  </Button>
                  <Popconfirm
                    title="Delete this playlist?"
                    onConfirm={() => handleDeletePlaylist(selected)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              {tracksLoading ? (
                <div className="flex justify-center py-12">
                  <Spin />
                </div>
              ) : tracks.length === 0 ? (
                <Empty description="No videos in this playlist yet" className="py-12">
                  <Button type="primary" onClick={() => setAddDrawerOpen(true)}>
                    Add videos
                  </Button>
                </Empty>
              ) : (
                <div className="space-y-2">
                  {tracks.map((video, index) => (
                    <MediaPlaylistTrackRow
                      key={video.id}
                      video={video}
                      index={index}
                      directoryHandle={directoryHandle}
                      resolveFile={resolveFile}
                      onPlay={() => playTrack(video)}
                      onRemove={() => handleToggleVideo(video.id)}
                      onRating={(r) => handleRating(video, r)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Drawer
        title={selected ? `Add videos to “${selected.name}”` : 'Add videos'}
        open={addDrawerOpen && Boolean(selected)}
        onClose={() => setAddDrawerOpen(false)}
        width={520}
      >
        <Input.Search
          placeholder="Search videos…"
          allowClear
          className="mb-4"
          value={videoSearch}
          onChange={(e) => setVideoSearch(e.target.value)}
        />
        {videosLoading ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredPickerVideos.length === 0 ? (
              <Empty description="No videos found" />
            ) : (
              filteredPickerVideos.map((video) => {
                const inPlaylist = selected?.mediaIds.includes(video.id) ?? false;
                return (
                  <div
                    key={video.id}
                    className="flex gap-3 p-2 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-[120px] shrink-0 aspect-video rounded overflow-hidden bg-gray-900">
                      {directoryHandle ? (
                        <MediaVideoThumbnail
                          media={video}
                          resolveFile={resolveFile}
                          className="w-full h-full"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2 m-0 mb-1">
                        {getMediaDisplayName(video)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <ResolutionBadge media={video} />
                        <MediaStarRating
                          value={video.rating}
                          onChange={(r) => handleRating(video, r)}
                        />
                      </div>
                      <Button
                        size="small"
                        type={inPlaylist ? 'default' : 'primary'}
                        className="mt-2"
                        onClick={() => handleToggleVideo(video.id)}
                      >
                        {inPlaylist ? 'Remove' : 'Add'}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
