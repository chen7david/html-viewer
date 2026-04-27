import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow, format } from 'date-fns';
import { Button, Table, Space, Popconfirm, Tooltip, Input, message, Spin } from 'antd';
import { PlusOutlined, ReadOutlined, DeleteOutlined, SearchOutlined, RobotOutlined } from '@ant-design/icons';
import { useBookStorage } from '../hooks/useBookStorage';
import { parsePdfFile } from '../utils/pdfParser';
import { BookService } from '../services/BookService';

export default function BooksDashboard() {
  const navigate = useNavigate();
  const { books, isLoading, saveBook, deleteBook, reloadMetadata } = useBookStorage();
  const [searchText, setSearchText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [processingBookId, setProcessingBookId] = useState<string | null>(null);

  const filteredBooks = books.filter(b => 
    b.book.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      // Process sequentially to avoid memory spikes from parsing many PDFs at once.
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressIndex = i + 1;
        message.loading({
          content: `Queue ${progressIndex}/${files.length}: Parsing ${file.name}...`,
          key: 'pdf-upload-queue',
          duration: 0,
        });

        try {
          const parsedBook = await parsePdfFile(file);
          await saveBook(parsedBook);
          successCount += 1;
          message.success({
            content: `Queue ${progressIndex}/${files.length}: Saved ${parsedBook.title}`,
            key: 'pdf-upload-queue',
            duration: 1.5,
          });
        } catch (error) {
          failedCount += 1;
          console.error(error);
          message.error({
            content: `Queue ${progressIndex}/${files.length}: Failed ${file.name}`,
            key: 'pdf-upload-queue',
            duration: 2,
          });
        }
      }

      if (failedCount === 0) {
        message.success(`Queue complete: ${successCount} PDF(s) parsed and saved.`);
      } else {
        message.warning(`Queue complete: ${successCount} succeeded, ${failedCount} failed.`);
      }
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset input so same files can be selected again
      message.destroy('pdf-upload-queue');
    }
  };

  const handleAiClean = async (bookId: string, title: string) => {
    setProcessingBookId(bookId);
    const hideLoading = message.loading(`AI cleaning "${title}" in background...`, 0);
    try {
      await BookService.processBookWithAi(bookId);
      await reloadMetadata();
      message.success(`Finished AI cleaning "${title}".`);
    } catch (error: any) {
      console.error(error);
      message.error(error?.message || `Failed to AI-clean "${title}".`);
    } finally {
      hideLoading();
      setProcessingBookId(null);
    }
  };

  const columns = [
    {
      title: 'Book Title',
      dataIndex: ['book', 'title'],
      key: 'title',
      render: (text: string) => <span className="font-medium text-blue-800 dark:text-blue-400">{text}</span>,
    },
    {
      title: 'Pages',
      dataIndex: ['book', 'totalActualPages'],
      key: 'pages',
      render: (pages: number) => <span className="text-gray-500">{pages} Pages</span>,
    },
    {
      title: 'Imported At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: number) => (
        <Tooltip title={format(date, 'MMM d, yyyy h:mm a')}>
          <span className="text-gray-500 dark:text-gray-400 cursor-help border-b border-dashed border-gray-400 dark:border-gray-500">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: { id: string; aiProcessed?: boolean; book: { title: string } }) => (
        <Space size="middle">
          {!record.aiProcessed && (
            <Tooltip title="Clean this book with AI without opening it">
              <Button
                size="large"
                icon={processingBookId === record.id ? <Spin size="small" /> : <RobotOutlined />}
                disabled={processingBookId !== null}
                onClick={() => handleAiClean(record.id, record.book.title)}
                className="text-orange-600 border-orange-300 hover:border-orange-500 hover:text-orange-500 dark:text-orange-400 dark:border-orange-700 dark:bg-orange-950/20"
              >
                AI Clean
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Open Book Viewer">
            <Button size="large" type="primary" icon={<ReadOutlined />} onClick={() => navigate(`/book/${record.id}`)} className="bg-blue-600 hover:bg-blue-500 border-none shadow-md shadow-blue-500/20 px-6" >
               Read
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete this book?"
            description="Are you sure you want to completely delete this parsed book?"
            onConfirm={() => deleteBook(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Book">
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
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/20 text-white shrink-0 mt-1">
            <ReadOutlined className="text-4xl" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 tracking-tight mb-2">
              PDF Books Engine
            </h1>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
              Upload complex PDFs purely locally on your browser. View neatly separated pages, extract the raw JSON of your books entirely offline, entirely secure.
            </p>
          </div>
        </div>
        <div className="flex gap-3 self-end md:self-auto">
          {/* Global navigation handled by TopNavigation layout */}
        </div>
      </div>

      {/* Main Dashboard Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <Input.Search 
          placeholder="Search extracted books by title..." 
          allowClear 
          size="large"
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-md shadow-sm"
          enterButton={<Button icon={<SearchOutlined />} className="bg-indigo-500 border-none text-white hover:bg-indigo-400 dark:bg-indigo-600 dark:hover:bg-indigo-500" />}
        />
        
        <label className="relative cursor-pointer w-full sm:w-auto">
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            loading={isUploading}
            className="shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 bg-blue-600 font-semibold px-6 w-full transition-transform active:scale-95 pointer-events-none"
          >
            {isUploading ? "Queue Processing..." : "Upload Local PDFs"}
          </Button>
          <input 
            type="file" 
            accept="application/pdf"
            multiple
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-xl shadow-blue-900/5 dark:shadow-none">
        <Table 
          dataSource={filteredBooks} 
          columns={columns} 
          rowKey="id" 
          loading={isLoading}
          pagination={{ pageSize: 12, className: "dark:text-white mb-0 p-4" }}
          className="bg-transparent"
          locale={{ emptyText: <div className="p-8 text-gray-400 dark:text-gray-500">No locally stored books found. Drop a PDF to begin!</div> }}
        />
      </div>
    </div>
  );
}
