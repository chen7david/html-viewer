import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Table, Space, Popconfirm, Tooltip, Input } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { useHtmlStorage } from '../hooks/useHtmlStorage';
import type { HtmlDocument } from '../types/HtmlDocument';

export default function Dashboard() {
  const { documents, deleteDocument } = useHtmlStorage();
  const [searchText, setSearchText] = useState('');

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchText.toLowerCase()) || 
    doc.content.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { 
      title: 'Document Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string) => <strong className="text-emerald-800 text-base">{text}</strong>
    },
    { 
      title: 'Created', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      render: (val: number) => <span className="text-gray-500">{new Date(val).toLocaleDateString()} at {new Date(val).toLocaleTimeString()}</span> 
    },
    { 
      title: 'Last Updated', 
      dataIndex: 'updatedAt', 
      key: 'updatedAt', 
      render: (val: number) => <span className="text-gray-500">{new Date(val).toLocaleDateString()} at {new Date(val).toLocaleTimeString()}</span> 
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_: unknown, record: HtmlDocument) => (
        <Space size="middle">
          <Tooltip title="View Rendered HTML">
            <Link to={`/render/${record.id}`}>
              <Button icon={<EyeOutlined />} type="default" className="text-purple-600 border-purple-200 hover:bg-purple-50" />
            </Link>
          </Tooltip>
          <Tooltip title="Edit Source">
            <Link to={`/edit/${record.id}`}>
              <Button icon={<EditOutlined />} type="default" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" />
            </Link>
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm title="Delete this document?" onConfirm={() => deleteDocument(record.id)} okText="Delete" okType="danger">
              <Button icon={<DeleteOutlined />} danger type="text" className="hover:bg-red-50" />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-purple-600 drop-shadow-sm flex items-center gap-3">
            <FileTextOutlined className="text-emerald-500" />
            HTML Viewer
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Manage and preview your beautifully crafted HTML documents.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Input
            placeholder="Search documents..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="rounded-lg border-emerald-200 hover:border-emerald-400 focus:border-purple-400 w-full md:w-64"
            size="large"
            allowClear
          />
          <Link to="/edit">
            <Button type="primary" icon={<PlusOutlined />} size="large" className="w-full sm:w-auto shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all font-semibold px-6">
              New Document
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md shadow-xl shadow-emerald-100/50 rounded-2xl overflow-hidden border border-emerald-50">
        <Table 
          dataSource={filteredDocuments} 
          columns={columns} 
          rowKey="id" 
          pagination={{ pageSize: 15 }} 
          className="p-2"
        />
      </div>
    </div>
  );
}
