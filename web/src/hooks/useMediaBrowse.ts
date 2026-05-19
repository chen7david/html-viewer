import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MediaLibraryService } from '../services/media';
import type { MediaBrowseFacets, MediaFileRecord, PaginatedResult } from '../types/Media';
import {
  BROWSE_DEFAULT_PAGE_SIZE,
  arraysEqual,
  browseSearchParamsEqual,
  buildBrowseSearchParams,
  parseBrowseSearchParams,
} from '../utils/mediaBrowseParams';

export function useMediaBrowse(scanId: string | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = parseBrowseSearchParams(searchParams);

  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [search, setSearch] = useState(initial.search);
  const [selectedTags, setSelectedTags] = useState<string[]>(initial.selectedTags);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>(initial.selectedResolutions);
  const [facets, setFacets] = useState<MediaBrowseFacets>({ tags: [], resolutionLabels: [] });
  const [result, setResult] = useState<PaginatedResult<MediaFileRecord>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: BROWSE_DEFAULT_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Browser back/forward: URL → state
  useEffect(() => {
    const next = parseBrowseSearchParams(searchParams);
    if (next.page !== page) setPage(next.page);
    if (next.pageSize !== pageSize) setPageSize(next.pageSize);
    if (next.search !== search) setSearch(next.search);
    if (!arraysEqual(next.selectedTags, selectedTags)) setSelectedTags(next.selectedTags);
    if (!arraysEqual(next.selectedResolutions, selectedResolutions)) {
      setSelectedResolutions(next.selectedResolutions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL changes
  }, [searchParams]);

  // State → URL (stable compare avoids page-2 loading loops)
  useEffect(() => {
    const next = buildBrowseSearchParams({ page, pageSize, search, selectedTags, selectedResolutions });
    setSearchParams((current) => (browseSearchParamsEqual(next, current) ? current : next), {
      replace: true,
    });
  }, [page, pageSize, search, selectedTags, selectedResolutions, setSearchParams]);

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
    refresh();
  }, [refresh]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateSelectedTags = (value: string[]) => {
    setSelectedTags(value);
    setPage(1);
  };

  const updateSelectedResolutions = (value: string[]) => {
    setSelectedResolutions(value);
    setPage(1);
  };

  const updatePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  return {
    videos: result.items,
    total: result.total,
    page,
    pageSize,
    setPage,
    setPageSize: updatePageSize,
    search,
    setSearch: updateSearch,
    selectedTags,
    setSelectedTags: updateSelectedTags,
    selectedResolutions,
    setSelectedResolutions: updateSelectedResolutions,
    facets,
    isLoading,
    refresh,
    loadFacets,
  };
}
