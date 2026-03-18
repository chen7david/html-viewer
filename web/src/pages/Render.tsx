import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useHtmlStorage } from '../hooks/useHtmlStorage';
import { Button, Tooltip, message } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';

export default function Render() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDocument } = useHtmlStorage();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const doc = id ? getDocument(id) : undefined;

  useEffect(() => {
    if (!doc) {
      navigate('/');
    }
  }, [doc, navigate]);

  // Inject explicit document padding for screen preview and @page margins for actual printing
  const decoratedContent = doc ? (() => {
    const styles = `
      <style>
        body {
           padding: 15mm !important; 
           box-sizing: border-box;
        }
        @media print {
          @page {
            margin: 15mm;
          }
          body {
            padding: 0 !important;
            line-height: 1.3 !important; /* Density constraint */
            font-size: 11pt !important;
          }
          
          /* 1. Ignore original page boundaries (e.g. .section-break) */
          * {
            page-break-before: auto !important;
          }
          .section-break {
            display: none !important; /* Remove physical filler blocks */
          }
          
          /* Remove filler spaces across common tags */
          p, div, ul, ol, h1, h2, h3, h4, table {
            margin-top: 0 !important;
            margin-bottom: 8pt !important;
          }
          
          /* 2. Intelligent break avoidance */
          .instruction-header, img, table, tr, td, th, .keep-together {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h1, h2, h3, h4, th {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      </style>
    `;
    if (doc.content.includes('</head>')) {
       return doc.content.replace('</head>', `${styles}</head>`);
    } else {
       return styles + doc.content;
    }
  })() : '';

  // Execute a flawless, invisible printing flow independent of React's DOM
  const executePrint = () => {
    if (!doc) return;
    try {
      // 1. Create a pristine hidden iframe dedicated solely for printing
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'absolute';
      printIframe.style.top = '-10000px';
      printIframe.style.left = '-10000px';
      printIframe.style.width = '210mm'; // Render at exact A4 width for correct scaling
      printIframe.style.height = '297mm'; 
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);

      const cDoc = printIframe.contentWindow?.document;
      if (cDoc) {
        // 2. Write the decorated content and Trigger Print Native Dialog
        cDoc.open();
        cDoc.write(decoratedContent);
        cDoc.close();

        printIframe.onload = () => {
          setTimeout(() => {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(printIframe), 3000);
          }, 300); // Tiny buffer for CSS rendering to settle
        };
      }
    } catch (err) {
      message.error("Unable to execute isolated print. Please allow popups or check browser settings.");
      console.error(err);
    }
  };

  const handlePreviewLoad = () => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        const updateHeight = () => {
          if (iframe.contentWindow) {
             iframe.style.height = '10px';
             const height = iframe.contentWindow.document.documentElement.scrollHeight;
             iframe.style.height = `${height + 20}px`;
          }
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
      } catch (e) {
        console.error('Error binding auto-resize to iframe', e);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        executePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc]);

  if (!doc) return <div className="p-8 text-emerald-800 font-semibold flex items-center justify-center min-h-screen">Loading document...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      
      {/* Top Toolbar */}
      <div className="w-[210mm] max-w-full px-4 md:px-0 mb-6 flex justify-between items-center">
        <Button 
          onClick={() => navigate('/')} 
          icon={<ArrowLeftOutlined />}
          className="text-gray-600 bg-white border-gray-300 hover:bg-gray-50 hover:text-emerald-600 shadow-sm"
        >
          Back to Dashboard
        </Button>
        <Tooltip title="Print Document (Cmd+P)">
          <Button 
            type="primary" 
            icon={<PrinterOutlined />} 
            onClick={executePrint}
            className="shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 font-medium px-6"
          >
            Execute Perfect Print
          </Button>
        </Tooltip>
      </div>

      {/* A4 Document Preview Container */}
      <div className="w-[210mm] max-w-full bg-white shadow-2xl ring-1 ring-gray-200 mx-auto overflow-hidden">
        <iframe
          ref={iframeRef}
          title={doc.name}
          srcDoc={decoratedContent}
          onLoad={handlePreviewLoad}
          className="w-full border-none m-0 p-0 block bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{ minHeight: '297mm' }}
        />
      </div>
    </div>
  );
}
