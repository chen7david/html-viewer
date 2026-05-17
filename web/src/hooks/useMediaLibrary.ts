import { useCallback, useEffect, useState } from 'react';
import { MediaLibraryService } from '../services/media';
import type { MediaFileRecord, MediaKindFilter, PaginatedResult } from '../types/Media';

const DEFAULT_PAGE_SIZE = 20;

export function useMediaLibrary(scanId: string | undefined) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<MediaKindFilter>('all');
  const [result, setResult] = useState<PaginatedResult<MediaFileRecord>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!scanId) {
      setResult({ items: [], total: 0, page: 1, pageSize });
      return;
    }
    setIsLoading(true);
    try {
      const pageResult = await MediaLibraryService.getFilesPage({
        scanId,
        page,
        pageSize,
        search: search.trim() || undefined,
        kind,
      });
      setResult(pageResult);
    } finally {
      setIsLoading(false);
    }
  }, [scanId, page, pageSize, search, kind]);

  useEffect(() => {
    setPage(1);
  }, [scanId, search, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setKind('all');
    setPage(1);
  }, []);

  return {
    files: result.items,
    total: result.total,
    page,
    pageSize,
    setPage,
    setPageSize,
    search,
    setSearch,
    kind,
    setKind,
    isLoading,
    refresh,
    resetFilters,
  };
}
