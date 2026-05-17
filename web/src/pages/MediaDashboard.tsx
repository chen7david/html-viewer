import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
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
  PlusOutlined,
  ReloadOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { MediaLibraryService, MediaPlaylistService, MediaScanService } from '../services/media';
import type { DuplicateGroup, FolderProfile, MediaFileRecord, MediaPlaylist, MediaScanMeta } from '../types/Media';
import { formatBytes, formatDuration } from '../utils/mediaExtensions';
import { isDirectoryPickerSupported } from '../utils/mediaScanner';

export default function MediaDashboard() {
  const [scan, setScan] = useState<MediaScanMeta | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [playlists, setPlaylists] = useState<MediaPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedForPlaylist, setSelectedForPlaylist] = useState<string[]>([]);

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<MediaFileRecord[]>([]);

  const loadPersisted = useCallback(async () => {
    setIsLoading(true);
    try {
      const { scan: savedScan, directoryHandle: savedHandle, playlists: savedPlaylists } =
        await MediaLibraryService.loadAppState();
      setScan(savedScan ?? null);
      setDirectoryHandle(savedHandle ?? null);
      setPlaylists(savedPlaylists);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersisted();
  }, [loadPersisted]);

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

  useEffect(() => {
    if (!scan?.id || activeTab !== 'duplicates') return;
    setDuplicatesLoading(true);
    MediaLibraryService.getDuplicateGroups(scan.id)
      .then((groups) => {
        setDuplicates(groups);
        setDuplicateCount(groups.length);
      })
      .finally(() => setDuplicatesLoading(false));
  }, [scan?.id, activeTab, isScanning]);

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
    onLibraryRefresh: library.refresh,
  };

  const handlePickFolder = async () => {
    setIsScanning(true);
    setProgressText('Waiting for folder selection…');
    try {
      const result = await MediaScanService.pickAndScanFolder(scanCallbacks);
      setScan(result.scan);
      setDirectoryHandle(result.directoryHandle);
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

  const openCreatePlaylist = (preselectedIds: string[] = []) => {
    setSelectedForPlaylist(preselectedIds);
    setNewPlaylistName('');
    setPlaylistModalOpen(true);
  };

  const handleSavePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      message.warning('Enter a playlist name.');
      return;
    }
    if (selectedForPlaylist.length === 0) {
      message.warning('Select at least one track.');
      return;
    }
    await MediaPlaylistService.create(newPlaylistName, selectedForPlaylist);
    const updated = await MediaPlaylistService.getAll();
    setPlaylists(updated);
    setPlaylistModalOpen(false);
    message.success('Playlist saved to IndexedDB.');
  };

  const handleDeletePlaylist = async (id: string) => {
    await MediaPlaylistService.delete(id);
    const updated = await MediaPlaylistService.getAll();
    setPlaylists(updated);
    if (activePlaylistId === id) setActivePlaylistId(null);
    message.success('Playlist deleted.');
  };

  const togglePlaylistSelection = (id: string, checked: boolean) => {
    setSelectedForPlaylist((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const libraryColumns = [
    {
      title: 'File',
      key: 'name',
      render: (_: unknown, record: MediaFileRecord) => (
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">{record.name}</div>
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
        record.kind === 'video' && record.width && record.height
          ? `${record.width}×${record.height}`
          : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: MediaFileRecord) => (
        <Space size="small">
          <Tooltip title="Play">
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => playMedia(record)} />
          </Tooltip>
          <Tooltip title="Copy relative path">
            <Button icon={<CopyOutlined />} onClick={() => copyPath(record.relativePath)} />
          </Tooltip>
          <Checkbox
            checked={selectedForPlaylist.includes(record.id)}
            onChange={(e) => togglePlaylistSelection(record.id, e.target.checked)}
          >
            <span className="text-xs">Playlist</span>
          </Checkbox>
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
        <ul className="text-sm space-y-1 m-0 pl-4">
          {record.files.map((f) => (
            <li key={f.id} className="list-disc">
              <span className="font-medium">{f.name}</span>
              <span className="text-gray-500 ml-2">({f.relativePath})</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Keep',
      key: 'keep',
      width: 280,
      render: (_: unknown, record: DuplicateGroup) => {
        const keeper = record.files[0];
        return (
          <div className="text-sm">
            <div className="text-emerald-600 dark:text-emerald-400 font-medium">Suggested keep:</div>
            <div className="truncate" title={keeper.relativePath}>{keeper.relativePath}</div>
            <div className="text-xs text-gray-500 mt-1">
              Move duplicates → <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">_duplicates/</code>
            </div>
          </div>
        );
      },
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

      <Alert
        type="info"
        showIcon
        className="mb-10 border-violet-200 dark:border-violet-900/50"
        message="Browser permissions required"
        description={
          <ul className="list-disc pl-5 mb-0 space-y-1 text-sm">
            <li>
              When you click <strong>Pick media folder</strong>, your browser will ask permission to read that folder.
              This app never uploads your files — scanning and playback happen entirely on your device.
            </li>
            <li>
              Works best in <strong>Chrome</strong> or <strong>Edge</strong> on desktop (File System Access API). Safari/Firefox
              may not support folder picking.
            </li>
            <li>
              Your library uses <strong>Dexie</strong> (IndexedDB with separate tables for scans, files, and playlists) — each file is saved
              as it is analyzed, so refresh is safe. After refresh, use <strong>Reconnect folder</strong> then <strong>Resume analysis</strong>.
            </li>
            <li>
              Metadata is read one file at a time with an 8s timeout per file so unsupported codecs (e.g. some MKV/AVI) cannot freeze the app.
              Duplicate detection only deep-hashes files that share the same byte size.
            </li>
            <li>
              Path suggestions are recommendations only — the app does not move files on disk unless you do that yourself in Finder/Explorer.
            </li>
          </ul>
        }
      />

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
        <Button
          size="large"
          icon={<PlusOutlined />}
          onClick={() => openCreatePlaylist(selectedForPlaylist)}
          disabled={!scan}
        >
          Create playlist ({selectedForPlaylist.length})
        </Button>
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
              <Table
                dataSource={duplicates}
                columns={duplicateColumns}
                rowKey="fingerprint"
                loading={duplicatesLoading}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: scan ? 'No duplicates detected.' : 'Scan a folder first.' }}
              />
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
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-2">
                  {playlists.length === 0 ? (
                    <p className="text-gray-500">No playlists yet. Select tracks in the Library tab and click Create playlist.</p>
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
            ),
          },
        ]}
      />

      <Modal
        title={playingMedia ? `Playing: ${playingMedia.name}` : 'Player'}
        open={playerOpen}
        onCancel={closePlayer}
        footer={null}
        width={800}
        centered
        destroyOnClose
      >
        {playerUrl && playingMedia && (
          playingMedia.kind === 'video' ? (
            <video src={playerUrl} controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black" />
          ) : (
            <audio src={playerUrl} controls autoPlay className="w-full mt-4" />
          )
        )}
      </Modal>

      <Modal
        title="New playlist"
        open={playlistModalOpen}
        onOk={handleSavePlaylist}
        onCancel={() => setPlaylistModalOpen(false)}
        okText="Save to browser"
      >
        <Input
          placeholder="Playlist name"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          className="mb-3"
        />
        <p className="text-sm text-gray-500">{selectedForPlaylist.length} track(s) selected.</p>
      </Modal>
    </div>
  );
}
