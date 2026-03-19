import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Input, Tooltip, message, Spin } from 'antd';
import { ArrowLeftOutlined, FormatPainterOutlined, CopyOutlined, PrinterOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useHtmlStorage } from '../hooks/useHtmlStorage';
import { useThemeMode } from '../hooks/useThemeMode';

import MonacoEditor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import * as htmlPlugin from 'prettier/plugins/html';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDocument, createDocument, updateDocument } = useHtmlStorage();
  const { isDark } = useThemeMode();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [debouncedContent, setDebouncedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [docId, setDocId] = useState(id);
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_LINE') {
        const line = parseInt(event.data.line, 10);
        if (!isNaN(line) && editorRef.current) {
          editorRef.current.revealLineInCenter(line);
          editorRef.current.setPosition({ lineNumber: line, column: 1 });
          editorRef.current.focus();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load document
  useEffect(() => {
    if (id && !isLoaded) {
      const doc = getDocument(id);
      if (doc) {
        setName(doc.name);
        setContent(doc.content);
        setDebouncedContent(doc.content);
      } else {
        message.error('Document not found');
        navigate('/');
      }
    } else if (!id && !isLoaded) {
      setName('New Document');
      setContent('<html>\n<head>\n  <title>New Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>');
      setDebouncedContent('<html>\n<head>\n  <title>New Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>');
    }
    setIsLoaded(true);
  }, [id, getDocument, navigate, isLoaded]);

  // Auto-save & Debounce
  useEffect(() => {
    if (!isLoaded) return;
    setIsSaving(true);
    const timeout = setTimeout(() => {
      if (docId) {
        updateDocument(docId, name, content);
      } else {
        const newDoc = createDocument(name, content);
        setDocId(newDoc.id);
        navigate(`/edit/${newDoc.id}`, { replace: true });
      }
      setDebouncedContent(content);
      setIsSaving(false);
    }, 1000); // 1-second auto-save debounce
    return () => clearTimeout(timeout);
  }, [name, content, docId, isLoaded, createDocument, updateDocument, navigate]);

  const handleFormat = async () => {
    try {
      const formatted = await prettier.format(content, {
        parser: 'html',
        plugins: [htmlPlugin],
        printWidth: 100,
        htmlWhitespaceSensitivity: 'ignore'
      });
      setContent(formatted);
      message.success('Code beautifully formatted!');
    } catch {
      message.error('Format failed: please check if your HTML is valid.');
    }
  };

  const handleCopy = () => {
    if (!content) {
       message.warning('Nothing to copy!');
       return;
    }
    navigator.clipboard.writeText(content);
    message.success('Code copied to clipboard!');
  };

  const decoratedContent = (() => {
    const lines = debouncedContent.split('\n');
    const injectedHtml = lines.map((line, i) => {
      // Safely inject data-source-line into opening HTML tags
      return line.replace(/<([a-zA-Z][a-zA-Z0-9\-]*)(?=[/\s>])/g, `<$1 data-source-line="${i + 1}"`);
    }).join('\n');

    const styles = `
      <style>
        body { padding: 15mm !important; box-sizing: border-box; font-family: sans-serif; cursor: pointer; }
        [data-source-line]:hover { outline: 2px solid rgba(16, 185, 129, 0.4); outline-offset: -2px; transition: outline 0.1s; }
        @media print {
          @page { margin: 15mm; }
          body { padding: 0 !important; line-height: 1.3 !important; font-size: 11pt !important; }
          * { page-break-before: auto !important; }
          .section-break { display: none !important; }
          p, div, ul, ol, h1, h2, h3, h4, table { margin-top: 0 !important; margin-bottom: 8pt !important; }
          .instruction-header, img, table, tr, td, th, .keep-together { page-break-inside: avoid !important; break-inside: avoid !important; }
          h1, h2, h3, h4, th { page-break-after: avoid !important; break-after: avoid !important; }
          [data-source-line]:hover { outline: none !important; }
        }
      </style>
      <script>
        document.addEventListener('click', function(e) {
          const target = e.target.closest('[data-source-line]');
          if (target) {
            e.preventDefault();
            e.stopPropagation();
            window.parent.postMessage({ type: 'SYNC_LINE', line: target.getAttribute('data-source-line') }, '*');
          }
        }, true);
      </script>
    `;
    if (injectedHtml.includes('</head>')) {
      return injectedHtml.replace('</head>', `${styles}</head>`);
    } else {
      return styles + injectedHtml;
    }
  })();

  // Printing logic
  const executePrint = useCallback(() => {
    try {
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.top = '-10000px';
      printIframe.style.left = '-10000px';
      printIframe.style.width = '210mm'; 
      printIframe.style.height = '297mm';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);

      const cDoc = printIframe.contentWindow?.document;
      if (cDoc) {
        const originalTitle = document.title;
        document.title = name;

        cDoc.open();
        cDoc.write(decoratedContent);
        cDoc.close();

        printIframe.onload = () => {
          setTimeout(() => {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
            document.title = originalTitle;
            setTimeout(() => document.body.removeChild(printIframe), 3000);
          }, 300); 
        };
      }
    } catch (err) {
      message.error("Unable to execute isolated print. Please allow popups or check browser settings.");
      console.error(err);
    }
  }, [name, decoratedContent]);

  // Handle Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        executePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executePrint]);

  if (!isLoaded) return <div className="p-8 text-emerald-800 flex items-center justify-center min-h-screen"><Spin size="large" /></div>;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/90 backdrop-blur tracking-tight px-4 flex justify-between items-center shadow-sm z-10 transition-colors duration-300">
        <div className="flex items-center gap-4 flex-1">
          <Tooltip title="Back to Dashboard">
            <Button onClick={() => navigate('/')} type="text" shape="circle" icon={<ArrowLeftOutlined />} className="text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400" />
          </Tooltip>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="text-lg font-bold bg-transparent border-transparent hover:border-gray-300 focus:border-emerald-500 max-w-sm px-2 shadow-none dark:text-white dark:hover:border-gray-600 transition-colors"
            placeholder="Document Name"
          />
          <div className="text-xs text-gray-400 flex items-center gap-1 ml-2 select-none">
            {isSaving ? <><SyncOutlined spin /> Saving...</> : <><CheckCircleOutlined className="text-emerald-500" /> Saved</>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Tooltip title="Copy HTML to Clipboard">
            <Button icon={<CopyOutlined />} onClick={handleCopy} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:bg-gray-900 dark:border-gray-700 dark:text-emerald-400 dark:hover:bg-gray-700 rounded-full font-medium">
              <span className="hidden sm:inline">Copy</span>
            </Button>
          </Tooltip>
          <Tooltip title="Auto-format HTML via Prettier">
            <Button icon={<FormatPainterOutlined />} onClick={handleFormat} className="text-purple-600 border-purple-200 hover:bg-purple-50 dark:bg-gray-900 dark:border-gray-700 dark:text-purple-400 dark:hover:bg-gray-700 rounded-full font-medium">
              <span className="hidden sm:inline">Format</span>
            </Button>
          </Tooltip>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
          <Tooltip title="Print Document (Cmd+P)">
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={executePrint}
              className="shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 font-medium px-6 rounded-full"
            >
              Print
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Main Split Screen Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Pane - Code Editor */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <div className="bg-gray-100 dark:bg-[#1a1c23] px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0 shadow-inner flex justify-between items-center z-10">
            <span>HTML Source</span>
            <span className="text-gray-400 text-[10px] font-normal tracking-normal">Monaco Editor</span>
          </div>
          <div className="flex-1 relative bg-white dark:bg-[#1e1e1e]">
            <MonacoEditor
              height="100%"
              defaultLanguage="html"
              value={content}
              onChange={(val) => setContent(val || '')}
              onMount={(editor) => { editorRef.current = editor; }}
              theme={isDark ? "vs-dark" : "light"}
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                formatOnPaste: true,
                padding: { top: 16 }
              }}
            />
          </div>
        </div>

        {/* Right Pane - Live Preview */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-200 dark:bg-gray-900 flex flex-col relative z-0">
          <div className="bg-gray-200 dark:bg-[#1a1c23] px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0 flex justify-between items-center shadow-inner border-t md:border-t-0 border-gray-300 dark:border-gray-800 z-10">
            <span>Live Preview</span>
            <span className="text-gray-400 text-[10px] font-normal tracking-normal">Auto-scaling</span>
          </div>
          
          <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
             {/* Render container simulating an A4 page wrapper */}
             <div className="w-[210mm] min-h-[297mm] max-w-full bg-white shadow-2xl ring-1 ring-gray-300 dark:ring-gray-700 mx-auto overflow-hidden shrink-0 transition-all duration-300">
                <iframe
                  ref={iframeRef}
                  title="Live HTML Preview"
                  srcDoc={decoratedContent}
                  className="w-full h-full min-h-[297mm] border-none m-0 p-0 block bg-white"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
