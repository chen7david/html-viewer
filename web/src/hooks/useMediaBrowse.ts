import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MediaLibraryService } from '../services/media';
import type { MediaBrowseFacets, MediaFileRecord, PaginatedResult } from '../types/Media';

const DEFAULT_PAGE_SIZE = 20;

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function useMediaBrowse(scanId: string | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? '1') || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => parseList(searchParams.get('tags')));
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>(() => parseList(searchParams.get('res')));
  const [facets, setFacets] = useState<MediaBrowseFacets>({ tags: [], resolutionLabels: [] });
  const [result, setResult] = useState<PaginatedResult<MediaFileRecord>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const nextPage = Number(searchParams.get('page') ?? '1') || 1;
    const nextPageSize = Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE;
    const nextSearch = searchParams.get('q') ?? '';
    const nextTags = parseList(searchParams.get('tags'));
    const nextResolutions = parseList(searchParams.get('res'));

    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
    if (nextSearch !== search) setSearch(nextSearch);
    if (!arraysEqual(nextTags, selectedTags)) setSelectedTags(nextTags);
    if (!arraysEqual(nextResolutions, selectedResolutions)) setSelectedResolutions(nextResolutions);
  }, [searchParams, page, pageSize, search, selectedTags, selectedResolutions]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));

    if (pageSize === DEFAULT_PAGE_SIZE) params.delete('pageSize');
    else params.set('pageSize', String(pageSize));

    if (!search.trim()) params.delete('q');
    else params.set('q', search.trim());

    if (selectedTags.length === 0) params.delete('tags');
    else params.set('tags', selectedTags.join(','));

    if (selectedResolutions.length === 0) params.delete('res');
    else params.set('res', selectedResolutions.join(','));

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [page, pageSize, search, selectedTags, selectedResolutions, searchParams, setSearchParams]);

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
