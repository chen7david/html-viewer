import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MediaLibraryService } from '../services/media';
import type { MediaFileRecord, MediaPlaylist, MediaScanMeta } from '../types/Media';

interface MediaAppContextValue {
  scan: MediaScanMeta | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  playlists: MediaPlaylist[];
  isLoading: boolean;
  reload: () => Promise<void>;
  setScan: (scan: MediaScanMeta | null) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
  getMediaById: (id: string) => Promise<MediaFileRecord | undefined>;
}

const MediaAppContext = createContext<MediaAppContextValue | null>(null);

export function MediaAppProvider({ children }: { children: ReactNode }) {
  const [scan, setScan] = useState<MediaScanMeta | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [playlists, setPlaylists] = useState<MediaPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await MediaLibraryService.loadAppState();
      setScan(state.scan ?? null);
      setDirectoryHandle(state.directoryHandle ?? null);
      setPlaylists(state.playlists);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolveFile = useCallback(
    (media: MediaFileRecord) => {
      if (!directoryHandle) return Promise.reject(new Error('Reconnect your folder first.'));
      return MediaLibraryService.resolveFile(directoryHandle, media);
    },
    [directoryHandle],
  );

  const getMediaById = useCallback(
    async (id: string) => {
      if (!scan?.id) return undefined;
      const files = await MediaLibraryService.getPlaylistTracks(scan.id, [id]);
      return files[0];
    },
    [scan?.id],
  );

  const value = useMemo(
    () => ({
      scan,
      directoryHandle,
      playlists,
      isLoading,
      reload,
      setScan,
      setDirectoryHandle,
      resolveFile,
      getMediaById,
    }),
    [scan, directoryHandle, playlists, isLoading, reload, resolveFile, getMediaById],
  );

  return <MediaAppContext.Provider value={value}>{children}</MediaAppContext.Provider>;
}

export function useMediaApp() {
  const ctx = useContext(MediaAppContext);
  if (!ctx) throw new Error('useMediaApp must be used within MediaAppProvider');
  return ctx;
}
