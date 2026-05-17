import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  Button,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  AudioOutlined,
  CopyOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
  EditOutlined,
  UnorderedListOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import MediaEditMetadataModal from '../components/media/MediaEditMetadataModal';
import MediaVideoPlayer from '../components/media/MediaVideoPlayer';
import ResolutionBadge from '../components/media/ResolutionBadge';
import { useMediaApp } from '../contexts/MediaAppContext';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { MediaLibraryService, MediaPlaylistService, MediaScanService } from '../services/media';
import type { DuplicateGroup, FolderProfile, MediaFileRecord } from '../types/Media';
import { formatBytes, formatDuration } from '../utils/mediaExtensions';
import { getMediaDisplayName } from '../utils/mediaDisplayName';
import { DELETED_FOLDER, isDirectoryPickerSupported } from '../utils/mediaScanner';

export default function MediaDashboard() {
  const navigate = useNavigate();
  const {
    scan,
    setScan,
    directoryHandle,
    setDirectoryHandle,
    playlists,
    isLoading,
    reload: reloadApp,
  } = useMediaApp();
  const [isScanning, setIsScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [activeTab, setActiveTab] = useState('library');
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [folderProfiles, setFolderProfiles] = useState<FolderProfile[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const library = useMediaLibrary(scan?.id);

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playingMedia, setPlayingMedia] = useState<MediaFileRecord | null>(null);
  const playerUrlRef = useRef<string | null>(null);

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<MediaFileRecord[]>([]);

  const [editingFile, setEditingFile] = useState<MediaFileRecord | null>(null);
  const [facetTags, setFacetTags] = useState<string[]>([]);
  const [movingGroupId, setMovingGroupId] = useState<string | null>(null);
  const [refiningDuplicates, setRefiningDuplicates] = useState(false);

  useEffect(() => {
    return () => {
      if (playerUrlRef.current) URL.revokeObjectURL(playerUrlRef.current);
    };
  }, []);

  const [pendingMetadataCount, setPendingMetadataCount] = useState(0);

  useEffect(() => {
    if (!scan?.id) {
      setPendingMetadataCount(0);
      setDuplicateCount(0);
      return;
    }
    MediaLibraryService.countPendingMetadata(scan.id).then(setPendingMetadataCount);
    MediaLibraryService.getDuplicateGroups(scan.id)
      .then((groups) => setDuplicateCount(groups.length))
      .catch(() => setDuplicateCount(0));
  }, [scan?.id, scan?.status, isScanning]);

  const loadDuplicates = async () => {
    if (!scan?.id) return;
    setDuplicatesLoading(true);
    try {
      const groups = await MediaLibraryService.getDuplicateGroups(scan.id);
      setDuplicates(groups);
      setDuplicateCount(groups.length);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  useEffect(() => {
    if (!scan?.id || activeTab !== 'duplicates') return;
    void loadDuplicates();
  }, [scan?.id, activeTab, isScanning]);

  useEffect(() => {
    if (!scan?.id) {
      setFacetTags([]);
      return;
    }
    MediaLibraryService.getBrowseFacets(scan.id, 'all').then((f) => setFacetTags(f.tags));
  }, [scan?.id]);

  useEffect(() => {
    if (!scan?.id || activeTab !== 'folders') return;
    setFoldersLoading(true);
    MediaLibraryService.getFolderProfiles(scan.id)
      .then(setFolderProfiles)
      .finally(() => setFoldersLoading(false));
  }, [scan?.id, activeTab]);

  const isScanIncomplete = Boolean(
    scan && (scan.status !== 'complete' || pendingMetadataCount > 0),
  );

  const scanCallbacks = {
    onProgress: setProgressText,
    onMetaUpdate: setScan,
    onLibraryRefresh: () => {
      library.refresh();
    },
  };

  const handlePickFolder = async () => {
    setIsScanning(true);
    setProgressText('Waiting for folder selection…');
    try {
      const result = await MediaScanService.pickAndScanFolder(scanCallbacks);
      setScan(result.scan);
      setDirectoryHandle(result.directoryHandle);
      await reloadApp();
      message.success(`Indexed ${result.scan.fileCount} media file(s) from "${result.scan.rootName}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to scan folder.';
      if (!msg.toLowerCase().includes('aborted')) message.error(msg);
    } finally {
      setIsScanning(false);
      setProgressText('');
    }
  };

  const handleRescan = async () => {
    if (!directoryHandle) {
      message.info('Pick a folder first.');
      return;
    }
    setIsScanning(true);
    try {
      const updated = await MediaScanService.rescanSavedFolder(directoryHandle, scanCallbacks);
      setScan(updated);
      message.success('Library rescanned.');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Rescan failed.');
    } finally {
      setIsScanning(false);
      setProgressText('');
    }
  };

  const handleResumeAnalysis = async () => {
    if (!directoryHandle || !scan) {
      message.info('Reconnect your folder first, then resume analysis.');
      return;
    }
    if (scan.status === 'indexing') {
      message.warning('Indexing was interrupted. Use Rescan to rebuild the full file list.');
      return;
    }
    setIsScanning(true);
    try {
      const updated = await MediaScanService.resumeAnalysis(directoryHandle, scan, scanCallbacks);
      setScan(updated);
      message.success('Metadata analysis finished.');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not resume analysis.');
    } finally {
      setIsScanning(false);
      setProgressText('');
    }
  };

  const handleReconnect = async () => {
    if (!directoryHandle) {
      await handlePickFolder();
      return;
    }
    setIsScanning(true);
    try {
      const updated = await MediaScanService.rescanSavedFolder(directoryHandle, scanCallbacks);
      setScan(updated);
      message.success('Reconnected and refreshed library.');
    } catch {
      message.warning('Could not access the saved folder. Pick it again.');
      await handlePickFolder();
    } finally {
      setIsScanning(false);
      setProgressText('');
    }
  };

  const handleClearLibrary = async () => {
    await MediaLibraryService.clearLibrary();
    setScan(null);
    setDirectoryHandle(null);
    library.resetFilters();
    message.success('Local media index cleared.');
  };

  const playMedia = async (media: MediaFileRecord) => {
    if (media.kind === 'video') {
      navigate(`/media/watch/${media.id}`);
      return;
    }
    if (!directoryHandle) {
      message.error('Reconnect your folder before playback.');
      return;
    }
    try {
      const file = await MediaLibraryService.resolveFile(directoryHandle, media);
      if (playerUrlRef.current) URL.revokeObjectURL(playerUrlRef.current);
      const url = URL.createObjectURL(file);
      playerUrlRef.current = url;
      setPlayerUrl(url);
      setPlayingMedia(media);
      setPlayerOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not open file.');
    }
  };

  const closePlayer = () => {
    setPlayerOpen(false);
    setPlayingMedia(null);
    if (playerUrlRef.current) {
      URL.revokeObjectURL(playerUrlRef.current);
      playerUrlRef.current = null;
    }
    setPlayerUrl(null);
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      message.success('Path copied (relative to selected folder).');
    } catch {
      message.error('Could not copy path.');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    await MediaPlaylistService.delete(id);
    await reloadApp();
    if (activePlaylistId === id) setActivePlaylistId(null);
    message.success('Playlist deleted.');
  };

  const handleRefineDuplicates = async () => {
    if (!scan?.id || !directoryHandle) {
      message.info('Reconnect your folder first.');
      return;
    }
    setRefiningDuplicates(true);
    try {
      const count = await MediaLibraryService.refineDuplicatesOnDisk(scan.id, directoryHandle, setProgressText);
      message.success(count > 0 ? `Deep-checked ${count} same-size file(s).` : 'No same-size candidates to check.');
      await loadDuplicates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Duplicate scan failed.');
    } finally {
      setRefiningDuplicates(false);
      setProgressText('');
    }
  };

  const handleMoveDuplicateCopies = async (group: DuplicateGroup) => {
    if (!scan?.id || !directoryHandle) {
      message.info('Reconnect your folder first.');
      return;
    }
    setMovingGroupId(group.fingerprint);
    try {
      const { moved, errors } = await MediaLibraryService.moveDuplicateCopiesToDeleted(
        scan.id,
        directoryHandle,
        group,
      );
      if (moved > 0) {
        message.success(`Moved ${moved} duplicate(s) to ${DELETED_FOLDER}/. Delete them there when ready.`);
      }
      if (errors.length > 0) {
        message.warning(errors.slice(0, 3).join(' · '));
      }
      await loadDuplicates();
      library.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not move files.');
    } finally {
      setMovingGroupId(null);
    }
  };

  const libraryColumns = [
    {
      title: 'File',
      key: 'name',
      render: (_: unknown, record: MediaFileRecord) => (
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">
            {getMediaDisplayName(record)}
          </div>
          <div className="text-xs text-gray-400 font-mono truncate">.{record.extension}</div>
          <div className="text-xs text-gray-500 truncate" title={record.relativePath}>
            {record.relativePath}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'kind',
      key: 'kind',
      width: 90,
      render: (kind: string) =>
        kind === 'video' ? (
          <Tag icon={<VideoCameraOutlined />} color="purple">Video</Tag>
        ) : (
          <Tag icon={<AudioOutlined />} color="cyan">Audio</Tag>
        ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatBytes(size),
      sorter: (a: MediaFileRecord, b: MediaFileRecord) => a.size - b.size,
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 90,
      render: (_: unknown, record: MediaFileRecord) => formatDuration(record.duration),
    },
    {
      title: 'Resolution',
      key: 'resolution',
      width: 110,
      render: (_: unknown, record: MediaFileRecord) =>
        record.kind === 'video' ? <ResolutionBadge media={record} /> : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_: unknown, record: MediaFileRecord) => (
        <Space size="small">
          <Tooltip title="Play">
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => playMedia(record)} />
          </Tooltip>
          <Tooltip title="Edit name & tags">
            <Button icon={<EditOutlined />} onClick={() => setEditingFile(record)} />
          </Tooltip>
          <Tooltip title="Copy relative path">
            <Button icon={<CopyOutlined />} onClick={() => copyPath(record.relativePath)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const duplicateColumns = [
    {
      title: 'Group',
      key: 'group',
      render: (_: unknown, record: DuplicateGroup) => (
        <div>
          <div className="text-xs text-gray-500 font-mono truncate max-w-md" title={record.fingerprint}>
            {record.fingerprint.slice(0, 16)}…
          </div>
          <div className="text-sm text-amber-600 dark:text-amber-400">
            {record.files.length} copies · {formatBytes(record.wastedBytes)} recoverable
          </div>
        </div>
      ),
    },
    {
      title: 'Files',
      key: 'files',
      render: (_: unknown, record: DuplicateGroup) => (
        <ul className="text-sm space-y-2 m-0 pl-4">
          {record.files.map((f) => {
            const isKeeper = f.id === record.keeper.id;
            return (
              <li key={f.id} className={`list-disc ${isKeeper ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                <span className="font-medium">{getMediaDisplayName(f)}</span>
                {f.kind === 'video' && (
                  <span className="ml-2">
                    <ResolutionBadge media={f} />
                  </span>
                )}
                {isKeeper && <span className="ml-1 text-xs font-semibold">(keep)</span>}
                <div className="text-gray-500 text-xs truncate" title={f.relativePath}>
                  {f.relativePath}
                </div>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      title: 'Keep (highest quality)',
      key: 'keep',
      width: 260,
      render: (_: unknown, record: DuplicateGroup) => {
        const keeper = record.keeper;
        return (
          <div className="text-sm">
            <div className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">Keep this copy:</div>
            <div className="truncate font-medium" title={keeper.relativePath}>
              {getMediaDisplayName(keeper)}
            </div>
            {keeper.kind === 'video' && (
              <div className="mt-1">
                <ResolutionBadge media={keeper} />
              </div>
            )}
            <div className="text-xs text-gray-500 truncate mt-1" title={keeper.relativePath}>
              {keeper.relativePath}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'dupActions',
      width: 200,
      render: (_: unknown, record: DuplicateGroup) => (
        <Popconfirm
          title={`Move ${record.files.length - 1} lower-quality copy/copies to ${DELETED_FOLDER}/?`}
          description="Files stay on disk until you delete them from that folder."
          onConfirm={() => handleMoveDuplicateCopies(record)}
          okText="Move"
        >
          <Button
            danger
            size="small"
            loading={movingGroupId === record.fingerprint}
            disabled={!directoryHandle || record.files.length < 2}
          >
            Move duplicates
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const folderColumns = [
    { title: 'Folder', dataIndex: 'folderPath', key: 'folderPath' },
    { title: 'Files', dataIndex: 'fileCount', key: 'fileCount', width: 80 },
    { title: 'Videos', dataIndex: 'videoCount', key: 'videoCount', width: 80 },
    { title: 'Audio', dataIndex: 'audioCount', key: 'audioCount', width: 80 },
    {
      title: 'Total size',
      dataIndex: 'totalBytes',
      key: 'totalBytes',
      width: 110,
      render: (v: number) => formatBytes(v),
    },
    {
      title: 'Suggested destination on disk',
      dataIndex: 'suggestedDestination',
      key: 'suggestedDestination',
      render: (v: string) => <code className="text-emerald-700 dark:text-emerald-400">{v}</code>,
    },
  ];

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  useEffect(() => {
    if (!scan?.id || !activePlaylist) {
      setPlaylistTracks([]);
      return;
    }
    MediaLibraryService.getPlaylistTracks(scan.id, activePlaylist.mediaIds).then(setPlaylistTracks);
  }, [scan?.id, activePlaylist]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-4 rounded-2xl shadow-lg shadow-fuchsia-500/20 text-white shrink-0">
            <SoundOutlined className="text-4xl" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 tracking-tight mb-2">
              Media Library
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              Pick a folder on your computer, index every video and audio file (including subfolders), inspect metadata,
              find duplicates, profile where files could live, play media, and build playlists — all stored locally in your browser.
            </p>
          </div>
        </div>
      </div>

      {!isDirectoryPickerSupported() && (
        <Alert
          type="warning"
          showIcon
          className="mb-10"
          message="Folder picker not supported in this browser"
          description="Use Chrome or Edge on desktop to select a folder from your computer."
        />
      )}

      {isScanIncomplete && !isScanning && (
        <Alert
          type="warning"
          showIcon
          className="mb-6"
          message={
            scan?.status === 'indexing'
              ? 'Indexing was interrupted before the file list finished'
              : `${pendingMetadataCount} file(s) still need metadata analysis`
          }
          description={
            scan?.status === 'indexing'
              ? 'Use Rescan to rebuild the library from your folder.'
              : 'Your indexed files are saved. Reconnect the folder if needed, then resume to analyze the rest.'
          }
          action={
            scan?.status === 'indexing' ? (
              <Button size="small" onClick={handleRescan} disabled={!directoryHandle}>
                Rescan
              </Button>
            ) : (
              <Button size="small" type="primary" onClick={handleResumeAnalysis} disabled={!directoryHandle}>
                Resume analysis
              </Button>
            )
          }
        />
      )}

      <div className="flex flex-wrap gap-3 mb-6 mt-4">
        <Button
          type="primary"
          size="large"
          icon={<FolderOpenOutlined />}
          onClick={handlePickFolder}
          loading={isScanning}
          disabled={!isDirectoryPickerSupported()}
          className="bg-violet-600 hover:bg-violet-500 border-none shadow-lg shadow-violet-500/30"
        >
          Pick media folder
        </Button>
        <Button size="large" icon={<ReloadOutlined />} onClick={handleRescan} loading={isScanning} disabled={!directoryHandle}>
          Rescan
        </Button>
        <Button size="large" onClick={handleReconnect} loading={isScanning}>
          Reconnect folder
        </Button>
        <Button
          size="large"
          onClick={handleResumeAnalysis}
          loading={isScanning}
          disabled={!directoryHandle || !scan || !isScanIncomplete || scan.status === 'indexing'}
        >
          Resume analysis
        </Button>
        <Link to="/media/browse">
          <Button size="large" type="primary" className="bg-violet-600" disabled={!scan}>
            Browse videos
          </Button>
        </Link>
        <Link to="/media/playlists">
          <Button size="large" icon={<UnorderedListOutlined />} disabled={!scan}>
            Playlists
          </Button>
        </Link>
        <Popconfirm title="Clear indexed library?" onConfirm={handleClearLibrary}>
          <Button size="large" danger icon={<DeleteOutlined />}>
            Clear index
          </Button>
        </Popconfirm>
      </div>

      {isScanning && (
        <Alert type="info" message={progressText || 'Scanning…'} className="mb-6" />
      )}

      {scan && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          <Tag color="purple">{scan.rootName}</Tag>
          <span>{scan.fileCount} files · {formatBytes(scan.totalBytes)}</span>
          <span>Scanned {formatDistanceToNow(scan.scannedAt, { addSuffix: true })}</span>
          {duplicateCount > 0 && (
            <Tag color="orange">{duplicateCount} duplicate group(s)</Tag>
          )}
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'library',
            label: 'Library',
            children: (
              <div>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <Input.Search
                    placeholder="Search by name or path…"
                    allowClear
                    size="large"
                    value={library.search}
                    onChange={(e) => library.setSearch(e.target.value)}
                    className="max-w-md"
                  />
                  <Space>
                    <Button type={library.kind === 'all' ? 'primary' : 'default'} onClick={() => library.setKind('all')}>All</Button>
                    <Button type={library.kind === 'video' ? 'primary' : 'default'} onClick={() => library.setKind('video')}>Video</Button>
                    <Button type={library.kind === 'audio' ? 'primary' : 'default'} onClick={() => library.setKind('audio')}>Audio</Button>
                  </Space>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 overflow-x-auto">
                  <Table
                    dataSource={library.files}
                    columns={libraryColumns}
                    rowKey="id"
                    loading={library.isLoading || isScanning}
                    pagination={{
                      current: library.page,
                      pageSize: library.pageSize,
                      total: library.total,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
                      showTotal: (total) => `${total} files`,
                      onChange: (nextPage, nextSize) => {
                        library.setPage(nextPage);
                        if (nextSize && nextSize !== library.pageSize) library.setPageSize(nextSize);
                      },
                    }}
                    locale={{
                      emptyText: scan
                        ? 'No files match your filters.'
                        : 'Pick a media folder to build your library.',
                    }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'duplicates',
            label: `Duplicates (${duplicates.length})`,
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  className="mb-4"
                  message="Duplicate handling"
                  description={
                    <>
                      We keep the <strong>highest resolution</strong> copy. Lower-quality duplicates can be moved to{' '}
                      <code>{DELETED_FOLDER}/</code> on disk — delete them there when you are ready. Moving files needs
                      write permission on your folder.
                    </>
                  }
                />
                <Space className="mb-4">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleRefineDuplicates}
                    loading={refiningDuplicates}
                    disabled={!directoryHandle}
                  >
                    Scan for duplicates
                  </Button>
                </Space>
                <Table
                  dataSource={duplicates}
                  columns={duplicateColumns}
                  rowKey="fingerprint"
                  loading={duplicatesLoading || refiningDuplicates}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: scan ? 'No duplicates detected.' : 'Scan a folder first.' }}
                />
              </div>
            ),
          },
          {
            key: 'folders',
            label: 'Path profile',
            children: (
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                  How your current folder layout maps to suggested destinations if you reorganize on disk (e.g. separate Videos/ and Music/ trees).
                </p>
                <Table
                  dataSource={folderProfiles}
                  columns={folderColumns}
                  rowKey="folderPath"
                  loading={foldersLoading}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: 'Scan a folder to see path profiles.' }}
                />
              </div>
            ),
          },
          {
            key: 'playlists',
            label: `Playlists (${playlists.length})`,
            children: (
              <div>
                <div className="mb-6 flex flex-wrap gap-3 items-center">
                  <Link to="/media/playlists">
                    <Button type="primary" icon={<UnorderedListOutlined />}>
                      Open playlist manager
                    </Button>
                  </Link>
                  <p className="text-sm text-gray-500 m-0">
                    Create playlists and add videos on the full playlists page.
                  </p>
                </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-2">
                  {playlists.length === 0 ? (
                    <p className="text-gray-500">No playlists yet.</p>
                  ) : (
                    playlists.map((p) => (
                      <Button
                        key={p.id}
                        block
                        type={activePlaylistId === p.id ? 'primary' : 'default'}
                        className={activePlaylistId === p.id ? 'bg-violet-600' : ''}
                        onClick={() => setActivePlaylistId(p.id)}
                      >
                        {p.name} ({p.mediaIds.length})
                      </Button>
                    ))
                  )}
                </div>
                <div className="md:col-span-2">
                  {activePlaylist ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold m-0">{activePlaylist.name}</h3>
                        <Popconfirm title="Delete playlist?" onConfirm={() => handleDeletePlaylist(activePlaylist.id)}>
                          <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
                        </Popconfirm>
                      </div>
                      <Table
                        dataSource={playlistTracks}
                        rowKey="id"
                        pagination={false}
                        columns={[
                          { title: 'Track', dataIndex: 'name', key: 'name' },
                          {
                            title: 'Play',
                            key: 'play',
                            width: 80,
                            render: (_: unknown, record: MediaFileRecord) => (
                              <Button icon={<PlayCircleOutlined />} onClick={() => playMedia(record)} />
                            ),
                          },
                        ]}
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">Select a playlist to view and play tracks.</p>
                  )}
                </div>
              </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={playingMedia ? `Playing: ${playingMedia.name}` : 'Player'}
        open={playerOpen}
        onCancel={closePlayer}
        footer={null}
        width={920}
        centered
        destroyOnClose
        styles={{ body: { paddingTop: 12 } }}
      >
        {playerUrl && playingMedia && (
          <MediaVideoPlayer
            src={playerUrl}
            title={playingMedia.name}
            kind={playingMedia.kind}
          />
        )}
      </Modal>

      <MediaEditMetadataModal
        open={Boolean(editingFile)}
        file={editingFile}
        scanId={scan?.id}
        facetTags={facetTags}
        onClose={() => setEditingFile(null)}
        onSaved={() => {
          library.refresh();
          if (scan?.id) {
            MediaLibraryService.getBrowseFacets(scan.id, 'all').then((f) => setFacetTags(f.tags));
          }
        }}
      />
    </div>
  );
}
