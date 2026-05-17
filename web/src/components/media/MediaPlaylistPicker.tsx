import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Dropdown, Input, Modal, message, type MenuProps } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { MediaPlaylistService } from '../../services/media';
import type { MediaFileRecord } from '../../types/Media';

interface MediaPlaylistPickerProps {
  video: MediaFileRecord;
  size?: 'small' | 'middle';
}

export default function MediaPlaylistPicker({ video, size = 'small' }: MediaPlaylistPickerProps) {
  const { playlists, reload } = useMediaApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const togglePlaylist = async (playlistId: string) => {
    setBusy(true);
    try {
      const updated = await MediaPlaylistService.toggleMedia(playlistId, video.id);
      const added = updated.mediaIds.includes(video.id);
      message.success(added ? 'Added to playlist' : 'Removed from playlist');
      await reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not update playlist');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) {
      message.warning('Enter a playlist name.');
      return;
    }
    setBusy(true);
    try {
      await MediaPlaylistService.createAndAdd(newName.trim(), video.id);
      message.success('Playlist created.');
      setCreateOpen(false);
      setNewName('');
      await reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Could not create playlist');
    } finally {
      setBusy(false);
    }
  };

  const menuItems: MenuProps['items'] = [
    ...playlists.map((p) => ({
      key: p.id,
      label: (
        <span className="flex items-center justify-between gap-3 min-w-[180px]">
          <span className="truncate">{p.name}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {p.mediaIds.includes(video.id) ? '✓' : `${p.mediaIds.length}`}
          </span>
        </span>
      ),
    })),
    { type: 'divider' as const },
    {
      key: 'new',
      label: (
        <span className="text-violet-600 dark:text-violet-400">
          <PlusOutlined className="mr-1" />
          New playlist…
        </span>
      ),
    },
    {
      key: 'manage',
      label: <Link to="/media/playlists">Manage playlists</Link>,
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (key === 'new') {
      setCreateOpen(true);
      return;
    }
    if (key === 'manage') return;
    void togglePlaylist(key);
  };

  return (
    <>
      <Dropdown
        menu={{ items: menuItems, onClick: onMenuClick }}
        trigger={['click']}
        disabled={busy}
      >
        <Button
          size={size}
          icon={<UnorderedListOutlined />}
          onClick={(e) => e.stopPropagation()}
        >
          Playlist
        </Button>
      </Dropdown>

      <Modal
        title="New playlist"
        open={createOpen}
        onOk={handleCreateAndAdd}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={busy}
        okText="Create & add video"
        destroyOnClose
      >
        <Input
          placeholder="Playlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreateAndAdd}
        />
      </Modal>
    </>
  );
}
