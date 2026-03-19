import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Table, Space, Popconfirm, Tooltip, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, SearchOutlined, MoonOutlined, SunOutlined, SettingOutlined } from '@ant-design/icons';
import { useHtmlStorage } from '../hooks/useHtmlStorage';
import { useThemeMode } from '../hooks/useThemeMode';

export default function Dashboard() {
  const navigate = useNavigate();
  const { documents, deleteDocument } = useHtmlStorage();
  const [searchText, setSearchText] = useState('');
  const { isDark, toggleTheme } = useThemeMode();

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Document Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-medium text-emerald-800 dark:text-emerald-400">{text}</span>,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: number) => <span className="text-gray-500 dark:text-gray-400">{new Date(date).toLocaleDateString()} {new Date(date).toLocaleTimeString()}</span>,
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: number) => <span className="text-gray-500 dark:text-gray-400">{new Date(date).toLocaleDateString()} {new Date(date).toLocaleTimeString()}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: { id: string }) => (
        <Space size="middle">
          <Tooltip title="Edit Source Code">
            <Button size="large" icon={<EditOutlined />} onClick={() => navigate(`/edit/${record.id}`)} className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:bg-transparent dark:hover:bg-purple-900/40" />
          </Tooltip>
          <Popconfirm
            title="Delete this document?"
            description="Are you sure you want to completely delete this HTML document?"
            onConfirm={() => deleteDocument(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Document">
              <Button size="large" danger icon={<DeleteOutlined />} className="dark:bg-transparent" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      
      {/* Hero Landing Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-purple-600 p-4 rounded-2xl shadow-lg shadow-purple-500/20 text-white shrink-0 mt-1">
            <FileTextOutlined className="text-4xl" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-purple-600 dark:from-emerald-400 dark:to-purple-400 tracking-tight mb-2">
              HTML Document Engine
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              With the dawn of advanced AI tools that can generate files, many are far better at producing brilliantly formatted HTML than generating raw PDFs. As a perfect middle ground, we've created this tool: cleanly paste your HTML documents, edit them, and flawlessly print them out for a streamlined workflow without any page cutoffs!
            </p>
          </div>
        </div>
        <div className="flex gap-3 self-end md:self-auto">
          <Tooltip title="Data Management & Backup">
            <Button 
              onClick={() => navigate('/settings')} 
              shape="circle" 
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />} 
              size="large" 
              className="shadow-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:text-emerald-500"
            />
          </Tooltip>
          <Button 
            onClick={toggleTheme} 
            shape="circle" 
            icon={isDark ? <SunOutlined className="text-yellow-400" /> : <MoonOutlined className="text-purple-600" />} 
            size="large" 
            className="shadow-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
      </div>

      {/* Main Dashboard Panel - Stripped UI Wrapper as Requested */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <Input.Search 
          placeholder="Search documents by name or HTML content..." 
          allowClear 
          size="large"
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-md shadow-sm"
          enterButton={<Button icon={<SearchOutlined />} className="bg-purple-500 border-none text-white hover:bg-purple-400 dark:bg-purple-600 dark:hover:bg-purple-500" />}
        />
        <Button 
          type="primary" 
          size="large" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/new')}
          className="shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 bg-emerald-600 font-semibold px-6 w-full sm:w-auto transition-transform active:scale-95"
        >
          Create New Document
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-xl shadow-emerald-900/5 dark:shadow-none">
        <Table 
          dataSource={filteredDocuments} 
          columns={columns} 
          rowKey="id" 
          pagination={{ pageSize: 12, className: "dark:text-white mb-0 p-4" }}
          className="bg-transparent"
          locale={{ emptyText: <div className="p-8 text-gray-400 dark:text-gray-500">No HTML documents found. Get started by creating one!</div> }}
        />
      </div>
    </div>
  );
}
