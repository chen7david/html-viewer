import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import Editor from '@monaco-editor/react';
import { Button, Tooltip, Tabs, message, Spin } from 'antd';
import { ArrowLeftOutlined, CopyOutlined, ReadOutlined, CodeOutlined, RobotOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useBookStorage } from '../hooks/useBookStorage';
import type { StoredBook } from '../repositories/BookRepository';
import { useThemeMode } from '../hooks/useThemeMode';
import { BookService } from '../services/BookService';

export default function BookViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBook } = useBookStorage();
  const { isDark } = useThemeMode();
  const [storedBook, setStoredBook] = useState<StoredBook | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState('');

  useEffect(() => {
    if (id) {
      getBook(id).then((b) => {
        if (b) setStoredBook(b);
        else message.error("Book not found").then(() => navigate('/books'));
      });
    }
  }, [id, navigate]);

  if (!storedBook) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">Loading locally extracted book...</div>;
  }

  const { book } = storedBook;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(book, null, 2));
    message.success("Copied extracted JSON to clipboard!");
  };

  const processAi = async () => {
    if (!id) return;
    setIsAiProcessing(true);
    try {
      const result = await BookService.processBookWithAi(id, (current, total, msg) => {
        setAiProgress(`[${current}/${total}] ${msg}`);
      });
      setStoredBook(result);
      message.success('Successfully scanned and formatted entire book with Gemini AI!');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'AI Parsing Failed. Have you added your Gemini key in Settings?');
    } finally {
       setIsAiProcessing(false);
       setAiProgress('');
    }
  };

  const PageView = () => (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 h-[calc(100vh-200px)] overflow-y-auto px-4 custom-scrollbar">
      {book.pages.map((page, idx) => (
        <div key={idx} className="bg-white dark:bg-gray-800 p-8 shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 relative">
          <div className="absolute top-4 right-4 bg-gray-100 dark:bg-gray-700 text-gray-400 text-xs px-2 py-1 rounded font-mono">
            Page {page.pageIndex}
          </div>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-serif whitespace-pre-wrap mt-4 text-base md:text-lg">
            {page.text || <span className="text-gray-400 italic">[Blank Page / Image Only]</span>}
          </p>
        </div>
      ))}
    </div>
  );

  const JsonView = () => (
    <div className="h-[calc(100vh-200px)] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-inner">
      <Editor
        height="100%"
        language="json"
        theme={isDark ? 'vs-dark' : 'light'}
        value={JSON.stringify(book, null, 2)}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          padding: { top: 24, bottom: 24 },
          fontSize: 14,
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/books')}
              icon={<ArrowLeftOutlined />}
              shape="circle"
              size="large"
              className="text-gray-600 border-gray-300 hover:text-blue-600 dark:text-gray-300 dark:border-gray-600 dark:hover:text-blue-400"
            />
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate max-w-sm md:max-w-lg mb-0 flex items-center gap-2">
                {book.title}
                {storedBook.aiProcessed && <Tooltip title="Semantically formatted by Gemini AI"><CheckCircleFilled className="text-orange-500 text-lg" /></Tooltip>}
              </h1>
              {isAiProcessing && <span className="text-xs text-orange-500 font-mono tracking-wider animate-pulse">{aiProgress}</span>}
            </div>
          </div>
          <div className="flex gap-3">
            {!storedBook.aiProcessed && (
              <Button
                type="default"
                icon={isAiProcessing ? <Spin size="small" /> : <RobotOutlined />}
                onClick={processAi}
                size="large"
                disabled={isAiProcessing}
                className="text-orange-600 border-orange-300 hover:border-orange-500 hover:text-orange-500 dark:text-orange-400 dark:border-orange-700 dark:bg-orange-950/20"
              >
                {isAiProcessing ? "AI Scanning..." : "Clean with AI"}
              </Button>
            )}
            <Tooltip title="Copy entire JSON representation">
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={handleCopyJson}
                size="large"
                className="bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 font-medium px-4 md:px-6"
              >
                <span className="hidden md:inline">Copy JSON</span>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs 
          defaultActiveKey="pages" 
          size="large"
          className="book-tabs"
          items={[
            {
              key: 'pages',
              label: <span className="flex items-center gap-2"><ReadOutlined /> Paginated View</span>,
              children: <PageView />
            },
            {
              key: 'json',
              label: <span className="flex items-center gap-2"><CodeOutlined /> Raw JSON Array</span>,
              children: <JsonView />
            }
          ]}
        />
      </div>

      <style>{`
        .book-tabs .ant-tabs-nav {
          margin-bottom: 32px !important;
        }
        .book-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #2563eb !important; /* blue-600 */
        }
        .book-tabs .ant-tabs-ink-bar {
          background: #2563eb !important;
        }
        .dark .book-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #60a5fa !important; /* blue-400 */
        }
        .dark .book-tabs .ant-tabs-ink-bar {
          background: #60a5fa !important;
        }
        .dark .book-tabs .ant-tabs-tab {
          color: #9ca3af;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4b5563;
        }
      `}</style>
    </div>
  );
}
