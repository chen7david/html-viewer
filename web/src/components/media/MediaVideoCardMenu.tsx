import { useState } from 'react';
import { Link } from 'react-router';
import { Dropdown, Input, Modal, message, type MenuProps } from 'antd';
import {
  EditOutlined,
  EllipsisOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useMediaApp } from '../../contexts/MediaAppContext';
import { MediaPlaylistService } from '../../services/media';
import type { MediaFileRecord } from '../../types/Media';

interface MediaVideoCardMenuProps {
  video: MediaFileRecord;
  onEdit: () => void;
  onShowInfo: () => void;
}

export default function MediaVideoCardMenu({ video, onEdit, onShowInfo }: MediaVideoCardMenuProps) {
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
    {
      key: 'info',
      icon: <InfoCircleOutlined />,
      label: 'Video details',
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit name & tags',
    },
    { type: 'divider' },
    {
      key: 'playlists',
      icon: <UnorderedListOutlined />,
      label: 'Add to playlist',
      children: [
        ...playlists.map((p) => ({
          key: `pl-${p.id}`,
          label: (
            <span className="flex items-center justify-between gap-3 min-w-[160px]">
              <span className="truncate">{p.name}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {p.mediaIds.includes(video.id) ? '✓' : p.mediaIds.length}
              </span>
            </span>
          ),
        })),
        { type: 'divider' as const },
        {
          key: 'new-playlist',
          icon: <PlusOutlined />,
          label: 'New playlist…',
        },
        {
          key: 'manage-playlists',
          label: <Link to="/media/playlists">Manage playlists</Link>,
        },
      ],
    },
  ];

  const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (key === 'info') {
      onShowInfo();
      return;
    }
    if (key === 'edit') {
      onEdit();
      return;
    }
    if (key === 'new-playlist') {
      setCreateOpen(true);
      return;
    }
    if (key === 'manage-playlists') return;
    if (key.startsWith('pl-')) {
      void togglePlaylist(key.slice(3));
    }
  };

  return (
    <>
      <Dropdown menu={{ items: menuItems, onClick: onMenuClick }} trigger={['click']} disabled={busy}>
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors"
          onClick={(e) => e.stopPropagation()}
          aria-label="More actions"
        >
          <EllipsisOutlined className="text-sm" />
        </button>
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
