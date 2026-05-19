/** URL query helpers for /media/browse — keeps param order stable to avoid sync loops. */

export const BROWSE_DEFAULT_PAGE_SIZE = 20;

export interface BrowseQueryState {
  page: number;
  pageSize: number;
  search: string;
  selectedTags: string[];
  selectedResolutions: string[];
}

export function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function buildBrowseSearchParams(state: BrowseQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page > 1) params.set('page', String(state.page));
  if (state.pageSize !== BROWSE_DEFAULT_PAGE_SIZE) params.set('pageSize', String(state.pageSize));
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.selectedTags.length > 0) params.set('tags', state.selectedTags.join(','));
  if (state.selectedResolutions.length > 0) params.set('res', state.selectedResolutions.join(','));
  return params;
}

export function parseBrowseSearchParams(params: URLSearchParams): BrowseQueryState {
  return {
    page: Number(params.get('page') ?? '1') || 1,
    pageSize: Number(params.get('pageSize') ?? String(BROWSE_DEFAULT_PAGE_SIZE)) || BROWSE_DEFAULT_PAGE_SIZE,
    search: params.get('q') ?? '',
    selectedTags: parseList(params.get('tags')),
    selectedResolutions: parseList(params.get('res')),
  };
}

export function browseSearchParamsEqual(a: URLSearchParams, b: URLSearchParams): boolean {
  return buildBrowseSearchParams(parseBrowseSearchParams(a)).toString()
    === buildBrowseSearchParams(parseBrowseSearchParams(b)).toString();
}
