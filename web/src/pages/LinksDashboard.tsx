import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button, Table, Space, Popconfirm, Tooltip, Input, message, Switch, Tag, Modal, Form, Select } from 'antd';
import { PlusOutlined, LinkOutlined, DeleteOutlined, CopyOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import { LinksService } from '../services/LinksService';
import type { LinkEntity } from '../types/Link';

export default function LinksDashboard() {
  const [links, setLinks] = useState<LinkEntity[]>([]);
  const [globalTags, setGlobalTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchText, setSearchText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkEntity | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setIsLoading(true);
    const data = await LinksService.getAllLinks();
    const tags = await LinksService.getAllTags();
    setLinks(data);
    setGlobalTags(tags);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = async (record: LinkEntity) => {
    try {
      await navigator.clipboard.writeText(record.url);
      message.success('Link copied to clipboard!');
      await LinksService.markCopied(record.id);
      loadData();
    } catch (err) {
      message.error('Failed to copy link.');
    }
  };

  const handleDelete = async (id: string) => {
    await LinksService.deleteLink(id);
    message.success('Link deleted successfully');
    loadData();
  };

  const handleToggleDead = async (id: string, isDead: boolean) => {
    await LinksService.updateLink(id, { isDead });
    loadData();
  };

  const openModal = async (link?: LinkEntity) => {
    if (link) {
      setEditingLink(link);
      form.setFieldsValue(link);
    } else {
      setEditingLink(null);
      form.resetFields();
      
      // Auto-paste valid URLs seamlessly from clipboard structure
      try {
        const text = await navigator.clipboard.readText();
        if (text && /^https?:\/\//i.test(text.trim())) {
          form.setFieldValue('url', text.trim());
          message.info('Auto-pasted URL from clipboard!');
        }
      } catch (err) {
        // Fail silently if clipboard is locked or empty
      }
    }
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingLink) {
        await LinksService.updateLink(editingLink.id, values);
        message.success('Link updated!');
      } else {
        await LinksService.addLink(values.name, values.url, values.tags || []);
        message.success('Link added!');
      }
      setIsModalVisible(false);
      loadData();
    } catch (err) {
      // Form validation failed
    }
  };

  const filteredLinks = links.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchText.toLowerCase()) || l.url.toLowerCase().includes(searchText.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => l.tags.includes(tag));
    return matchesSearch && matchesTags;
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: LinkEntity) => (
        <a href={record.url} target="_blank" rel="noopener noreferrer" className={`font-bold ${record.isDead ? 'text-gray-400 line-through' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500'}`}>
          {text}
        </a>
      ),
    },
    {
      title: 'Target URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => <span className="text-gray-500 text-xs truncate max-w-[250px] block" title={url}>{url}</span>,
    },
    {
      title: 'Tags',
      key: 'tags',
      dataIndex: 'tags',
      render: (tags: string[]) => (
        <div className="flex flex-wrap gap-1">
          {tags?.map(tag => (
            <Tag color={tag.length > 5 ? 'geekblue' : 'cyan'} key={tag}>{tag}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'isDead',
      render: (_: any, record: LinkEntity) => (
        <Space size="small">
          <Switch size="small" checked={!record.isDead} onChange={(checked) => handleToggleDead(record.id, !checked)} className={!record.isDead ? "bg-emerald-500" : "bg-red-500"} />
          <span className={`text-xs ${record.isDead ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>
            {record.isDead ? 'Dead Link' : 'Active'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Last Copied',
      dataIndex: 'lastCopiedAt',
      key: 'lastCopiedAt',
      render: (date: number) => (
        <span className="text-gray-500 dark:text-gray-400 text-sm">
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: LinkEntity) => (
        <Space size="small">
          <Tooltip title="Copy Link">
            <Button type="primary" size="large" icon={<CopyOutlined />} onClick={() => handleCopy(record)} className="bg-emerald-600 hover:bg-emerald-500 border-none shadow-md shadow-emerald-500/20 px-6 font-bold" >
               Copy
            </Button>
          </Tooltip>
          <Tooltip title="Open Page">
            <Button size="large" icon={<GlobalOutlined />} onClick={() => window.open(record.url, '_blank')} className="text-blue-600 hover:text-blue-500 border-gray-200" />
          </Tooltip>
          <Tooltip title="Edit Link">
            <Button size="large" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <Popconfirm title="Delete this link?" description="Are you sure you want to permanently delete this vault link?" onConfirm={() => handleDelete(record.id)} okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button size="large" danger icon={<DeleteOutlined />} className="dark:bg-transparent" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-lg shadow-teal-500/20 text-white shrink-0 mt-1">
            <LinkOutlined className="text-4xl" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 tracking-tight mb-2">
              Fast Links Engine
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              Store, organize, and instantly copy your most important URLs. Everything stays securely offline natively in IndexedDB, tracking dead links and automatically sorting by most recently copied.
            </p>
          </div>
        </div>
      </div>

      {/* Main Dashboard Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex w-full lg:w-2/3 gap-4 flex-col sm:flex-row">
          <Input.Search 
            placeholder="Search link names or target URLs..." 
            allowClear 
            size="large"
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 shadow-sm max-w-sm"
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter by master tags"
            value={selectedTags}
            onChange={setSelectedTags}
            options={globalTags.map(t => ({ label: t, value: t }))}
            className="flex-[2] shadow-sm [&_.ant-select-selector]:min-h-[40px] [&_.ant-select-selection-search-input]:!h-[40px]"
          />
        </div>
        
        <Button 
          type="primary" 
          size="large" 
          icon={<PlusOutlined />} 
          onClick={() => openModal()}
          className="shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 bg-emerald-600 font-semibold px-8 w-full lg:w-auto h-[44px]"
        >
          Add New Link
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-xl shadow-teal-900/5 dark:shadow-none">
        <Table 
          dataSource={filteredLinks} 
          columns={columns} 
          rowKey="id" 
          loading={isLoading}
          pagination={{ pageSize: 15, className: "dark:text-white mb-0 p-4" }}
          className="bg-transparent [&_.ant-table-thead_th]:bg-gray-50 dark:[&_.ant-table-thead_th]:bg-gray-900/50 dark:[&_.ant-table-thead_th]:text-gray-300 dark:[&_.ant-table-tbody_td]:text-gray-300 dark:[&_.ant-table-tbody_tr:hover_td]:bg-gray-700/30"
          locale={{ emptyText: <div className="p-8 text-gray-400 dark:text-gray-500">No structured links found in the secure local database. Add one to begin!</div> }}
        />
      </div>

      <Modal
        title={
          <div className="flex items-center gap-2 text-xl mb-4">
            <LinkOutlined className="text-emerald-600" />
            {editingLink ? "Edit Vault Link" : "Secure New Link"}
          </div>
        }
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        okText={editingLink ? "Save Changes" : "Save to Vault"}
        okButtonProps={{ className: "bg-emerald-600 hover:bg-emerald-500", size: "large" }}
        cancelButtonProps={{ size: "large" }}
        centered
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label={<span className="font-semibold text-gray-700 dark:text-gray-300">Link Name / Title</span>} rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g. Production Database Console" size="large" className="rounded-lg" />
          </Form.Item>
          <Form.Item name="url" label={<span className="font-semibold text-gray-700 dark:text-gray-300">Target URL</span>} rules={[{ required: true, message: 'Please enter a valid URL' }]}>
            <Input placeholder="https://..." size="large" className="rounded-lg" />
          </Form.Item>
          <Form.Item name="tags" label={<span className="font-semibold text-gray-700 dark:text-gray-300">Categorization Tags</span>}>
            <Select mode="tags" placeholder="Add custom tags (press enter)" size="large" className="[&_.ant-select-selector]:rounded-lg" options={globalTags.map(t => ({ label: t, value: t }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
