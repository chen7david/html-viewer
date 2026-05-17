import { Link } from 'react-router';
import { Button, Spin } from 'antd';
import { ArrowLeftOutlined, SoundOutlined, UnorderedListOutlined } from '@ant-design/icons';
import MediaBrowseTab from '../components/media/MediaBrowseTab';
import { useMediaApp } from '../contexts/MediaAppContext';
import { useMediaBrowse } from '../hooks/useMediaBrowse';

export default function MediaBrowsePage() {
  const { scan, directoryHandle, isLoading, resolveFile } = useMediaApp();
  const browse = useMediaBrowse(scan?.id);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link to="/media">
          <Button icon={<ArrowLeftOutlined />}>Media hub</Button>
        </Link>
        <Link to="/media/playlists">
          <Button icon={<UnorderedListOutlined />}>Playlists</Button>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3 rounded-xl text-white">
            <SoundOutlined className="text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold m-0">Browse videos</h1>
            <p className="text-gray-500 dark:text-gray-400 m-0 text-sm">
              Click a thumbnail to watch · hover for play
            </p>
          </div>
        </div>
      </div>

      <MediaBrowseTab
        browse={browse}
        hasScan={Boolean(scan)}
        directoryHandle={directoryHandle}
        resolveFile={resolveFile}
      />
    </div>
  );
}
