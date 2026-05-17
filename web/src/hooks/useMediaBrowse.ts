import { useCallback, useEffect, useState } from 'react';
import { MediaLibraryService } from '../services/media';
import type { MediaBrowseFacets, MediaFileRecord, PaginatedResult } from '../types/Media';

const DEFAULT_PAGE_SIZE = 20;

export function useMediaBrowse(scanId: string | undefined) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([]);
  const [facets, setFacets] = useState<MediaBrowseFacets>({ tags: [], resolutionLabels: [] });
  const [result, setResult] = useState<PaginatedResult<MediaFileRecord>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadFacets = useCallback(async () => {
    if (!scanId) {
      setFacets({ tags: [], resolutionLabels: [] });
      return;
    }
    const next = await MediaLibraryService.getBrowseFacets(scanId, 'video');
    setFacets(next);
  }, [scanId]);

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
        kind: 'video',
        search: search.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        resolutionLabels: selectedResolutions.length > 0 ? selectedResolutions : undefined,
      });
      setResult(pageResult);
    } finally {
      setIsLoading(false);
    }
  }, [scanId, page, pageSize, search, selectedTags, selectedResolutions]);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    setPage(1);
  }, [scanId, search, selectedTags, selectedResolutions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    videos: result.items,
    total: result.total,
    page,
    pageSize,
    setPage,
    setPageSize,
    search,
    setSearch,
    selectedTags,
    setSelectedTags,
    selectedResolutions,
    setSelectedResolutions,
    facets,
    isLoading,
    refresh,
    loadFacets,
  };
}
