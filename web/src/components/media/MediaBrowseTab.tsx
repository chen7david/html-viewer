import { Button, Empty, Input, Pagination, Select, Spin } from 'antd';
import type { useMediaBrowse } from '../../hooks/useMediaBrowse';
import type { MediaFileRecord } from '../../types/Media';
import MediaVideoCard from './MediaVideoCard';

type BrowseState = ReturnType<typeof useMediaBrowse>;

const FILTER_SELECT_CLASS =
  '[&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!min-h-10 [&_.ant-select-selection-wrap]:!min-h-10';

interface MediaBrowseTabProps {
  browse: BrowseState;
  hasScan: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  resolveFile: (media: MediaFileRecord) => Promise<File>;
}

export default function MediaBrowseTab({
  browse,
  hasScan,
  directoryHandle,
  resolveFile,
}: MediaBrowseTabProps) {
  if (!hasScan) {
    return <Empty description="Pick a media folder to browse videos" className="py-16" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40">
        <Input.Search
          placeholder="Search name, path, tags, quality…"
          allowClear
          size="large"
          value={browse.search}
          onChange={(e) => browse.setSearch(e.target.value)}
          className="flex-1 min-w-[220px] max-w-none [&_.ant-input-affix-wrapper]:h-10 [&_.ant-input]:h-[30px]"
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Tags"
          size="large"
          value={browse.selectedTags}
          onChange={browse.setSelectedTags}
          options={browse.facets.tags.map((t) => ({ label: t, value: t }))}
          className={`flex-1 min-w-[180px] max-w-[320px] ${FILTER_SELECT_CLASS}`}
          maxTagCount="responsive"
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Quality"
          size="large"
          value={browse.selectedResolutions}
          onChange={browse.setSelectedResolutions}
          options={browse.facets.resolutionLabels.map((r) => ({ label: r, value: r }))}
          className={`w-[140px] shrink-0 ${FILTER_SELECT_CLASS}`}
          maxTagCount="responsive"
        />
        <Button
          size="large"
          className="h-10 shrink-0"
          onClick={() => {
            browse.setSelectedTags([]);
            browse.setSelectedResolutions([]);
            browse.setSearch('');
          }}
        >
          Clear
        </Button>
      </div>

      {browse.isLoading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : browse.total === 0 ? (
        <Empty
          description={
            browse.search || browse.selectedTags.length || browse.selectedResolutions.length
              ? 'No videos match your filters'
              : 'No video files in this library yet'
          }
          className="py-12"
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Showing {(browse.page - 1) * browse.pageSize + 1}–
            {Math.min(browse.page * browse.pageSize, browse.total)} of {browse.total} videos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-stretch">
            {browse.videos.map((video) => (
              <MediaVideoCard
                key={video.id}
                showEdit
                video={video}
                directoryHandle={directoryHandle}
                resolveFile={resolveFile}
                facetTags={browse.facets.tags}
                onVideoUpdated={() => {
                  void browse.loadFacets();
                  void browse.refresh();
                }}
              />
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Pagination
              current={browse.page}
              pageSize={browse.pageSize}
              total={browse.total}
              showSizeChanger
              pageSizeOptions={[20, 40, 60, 100]}
              showTotal={(total) => `${total} videos`}
              onChange={(p, size) => {
                browse.setPage(p);
                if (size !== browse.pageSize) browse.setPageSize(size);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
