import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, message, Upload, Switch, Spin } from 'antd';
import { DownloadOutlined, UploadOutlined, RocketOutlined, ApiOutlined, ReadOutlined } from '@ant-design/icons';
import { useHtmlStorage } from '../hooks/useHtmlStorage';
import type { HtmlDocument } from '../types/HtmlDocument';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { BookRepository } from '../repositories/BookRepository';
import type { StoredBook } from '../repositories/BookRepository';

export default function Settings() {
  const navigate = useNavigate();
  const { documents, importDocuments } = useHtmlStorage();
  const [isMergingHtml, setIsMergingHtml] = useState(true);
  const [isMergingBooks, setIsMergingBooks] = useState(true);
  const [apiKey, setApiKey] = useState(SettingsRepository.getApiKey() || '');
  const [isExportingBooks, setIsExportingBooks] = useState(false);

  const handleExport = () => {
    if (documents.length === 0) {
      message.warning('No documents to export!');
      return;
    }
    const dataStr = JSON.stringify(documents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `html_engine_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('HTML Documents exported successfully!');
  };

  const handleExportBooks = async () => {
    setIsExportingBooks(true);
    message.loading({ content: 'Gathering massive PDF data from IndexedDB...', key: 'exportBook' });
    try {
      const fullBooks = await BookRepository.getAllFullBooks();
      if (fullBooks.length === 0) {
        message.warning({ content: 'No PDF Books to export!', key: 'exportBook' });
        return;
      }
      const dataStr = JSON.stringify(fullBooks, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pdf_books_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success({ content: 'PDF Books exported successfully! (Large File)', key: 'exportBook' });
    } catch (err) {
      message.error({ content: 'Failed to export massive book files.', key: 'exportBook' });
    } finally {
      setIsExportingBooks(false);
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result) as HtmlDocument[];
        // Basic validation
        if (!Array.isArray(parsed) || (parsed.length > 0 && !parsed[0].id)) {
          throw new Error("Invalid HTML document format");
        }
        
        importDocuments(parsed, isMergingHtml);
        message.success(`Successfully imported HTML documents!`);
      } catch (err) {
        console.error(err);
        message.error('Failed to parse the JSON file. Ensure it is a valid export.');
      }
    };
    reader.readAsText(file);
    return false; // Prevent default upload behavior
  };

  const handleImportBooks = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      message.loading({ content: 'Parsing massive JSON book data...', key: 'importBook' });
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result) as StoredBook[];
        // Basic validation
        if (!Array.isArray(parsed) || (parsed.length > 0 && !parsed[0].book?.title)) {
          throw new Error("Invalid PDF Book JSON format");
        }
        
        // If they want to overwrite, technically we'd need to clear first. 
        // For now, if not merging, we clear the entire DB first.
        if (!isMergingBooks) {
           const existing = await BookRepository.getAllBookSummaries();
           for (const b of existing) {
             await BookRepository.deleteBook(b.id);
           }
        }

        await BookRepository.saveMultipleBooks(parsed);
        message.success({ content: `Successfully imported ${parsed.length} PDF Books!`, key: 'importBook' });
      } catch (err) {
        console.error(err);
        message.error({ content: 'Failed to parse the massive JSON file.', key: 'importBook' });
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleSaveApiKey = () => {
    SettingsRepository.setApiKey(apiKey);
    if (apiKey.trim() === '') {
      message.info('API Key cleared successfully from local storage.');
    } else {
      message.success('Secured! Your API Key is safely stored in this browser strictly for local execution.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-400 mb-2">
            Data Management
          </h1>
          <p className="text-emerald-700 dark:text-emerald-500 max-w-2xl text-sm md:text-base leading-relaxed">
            <strong>The local version of this app is 100% free forever.</strong> All of your HTML documents are completely private and safely stored inside your browser's local storage. This Data Management page guarantees you will always be able to export your files to your computer, and seamlessly import them back in.
          </p>
        </div>
        <div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8 items-stretch mb-8">
        {/* API Settings Card */}
        <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-orange-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full xl:col-span-3">
           <div className="bg-orange-100 dark:bg-orange-900/40 p-3 rounded-full text-orange-600 dark:text-orange-400">
             <ApiOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full flex flex-col">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Gemini AI Configuration (Advanced)</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 max-w-4xl">
               To utilize advanced semantic formatting of PDF Books (cleaning up covers, headers, and footers), you must provide your own <strong>Google AI Studio API Key</strong>. Because this app is 100% strictly local with no backend server, our code executes the API call entirely within your browser to keep your files secure and private.
             </p>
             <div className="flex items-center gap-4 mt-2 max-w-3xl w-full">
               <input 
                 type="password" 
                 value={apiKey} 
                 onChange={(e) => setApiKey(e.target.value)} 
                 placeholder="Paste your Gemini AI Studio API Key here (AIzaSy...)" 
                 className="flex-1 w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner px-4 py-3 focus:outline-none focus:ring-2 ring-orange-400/50"
               />
               <Button type="primary" size="large" onClick={handleSaveApiKey} className="bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-500/20 px-8">
                 Securely Save
               </Button>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8 items-stretch">
         {/* Export Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-emerald-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-full text-emerald-600 dark:text-emerald-400">
             <DownloadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Export Documents</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Actively download a lightweight, local JSON backup of your entire cache directly into your filesystem. Keep a safe copy of all your work offline.</p>
           </div>
           
           <div className="w-full mt-auto pt-6">
             <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 w-full">
               Export Data (.json)
             </Button>
           </div>
         </div>

         {/* Import Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-purple-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-purple-100 dark:bg-purple-900/40 p-3 rounded-full text-purple-600 dark:text-purple-400">
             <UploadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full flex flex-col">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import Documents</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">Upload a previously exported JSON payload. You can securely merge new files alongside existing ones, or fully overwrite your local storage.</p>
             
             <div className="mt-auto flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 w-full shadow-sm mb-2">
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">Merge Data</span>
                <Switch 
                  checked={!isMergingHtml} 
                  onChange={(checked) => setIsMergingHtml(!checked)} 
                  className={!isMergingHtml ? "bg-red-500" : "bg-purple-500"}
                />
                <span className={!isMergingHtml ? "text-red-600 dark:text-red-400 font-bold text-sm leading-tight text-right w-20" : "text-gray-400 dark:text-gray-500 text-sm leading-tight text-right w-20"}>
                  Overwrite
                </span>
             </div>
           </div>
           
           <div className="w-full mt-auto">
             <Upload 
               accept=".json" 
               showUploadList={false} 
               beforeUpload={handleImport}
               className="w-full block [&_.ant-upload]:w-full"
             >
               <Button type="primary" size="large" icon={<UploadOutlined />} className="bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20 w-full">
                 Import JSON File
               </Button>
             </Upload>
           </div>
         </div>

         {/* PDF Books Export Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-blue-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full text-blue-600 dark:text-blue-400">
             <ReadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Export PDF Books</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Extract your massive library of deeply parsed AI PDF JSONs from your browser's IndexedDB. Warning: This file will be very large.</p>
           </div>
           
           <div className="w-full mt-auto pt-6">
             <Button type="primary" size="large" disabled={isExportingBooks} icon={isExportingBooks ? <Spin size="small" /> : <DownloadOutlined />} onClick={handleExportBooks} className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 w-full disabled:bg-gray-400">
               {isExportingBooks ? "Assembling Data..." : "Export Books (.json)"}
             </Button>
           </div>
         </div>

         {/* PDF Books Import Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-indigo-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-full text-indigo-600 dark:text-indigo-400">
             <ReadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full flex flex-col">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import PDF Books</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">Upload a massive PDF backup JSON payload exported previously to instantly restore your IndexedDB library.</p>
             
             <div className="mt-auto flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 w-full shadow-sm mb-2">
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">Merge Data</span>
                <Switch 
                  checked={!isMergingBooks} 
                  onChange={(checked) => setIsMergingBooks(!checked)} 
                  className={!isMergingBooks ? "bg-red-500" : "bg-indigo-500"}
                />
                <span className={!isMergingBooks ? "text-red-600 dark:text-red-400 font-bold text-sm leading-tight text-right w-20" : "text-gray-400 dark:text-gray-500 text-sm leading-tight text-right w-20"}>
                  Overwrite
                </span>
             </div>
           </div>
           
           <div className="w-full mt-auto">
             <Upload 
               accept=".json" 
               showUploadList={false} 
               beforeUpload={handleImportBooks}
               className="w-full block [&_.ant-upload]:w-full"
             >
               <Button type="primary" size="large" icon={<UploadOutlined />} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 w-full">
                 Import Books JSON
               </Button>
             </Upload>
           </div>
         </div>

         {/* Upgrade to Pro Card */}
         <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 shadow-xl shadow-blue-900/10 rounded-2xl p-8 border border-gray-700 flex flex-col items-start gap-4 h-full text-white relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-500" />
           <div className="bg-blue-500/20 p-3 rounded-full text-blue-400 relative z-10">
             <RocketOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full relative z-10 flex flex-col">
             <h2 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h2>
             <p className="text-gray-400 text-sm leading-relaxed mb-4 text-justify">When moving to the upcoming Paid version (which includes secure cloud sync and persistent user accounts), you simply export your offline cache here, log in, and import your documents safely into your new cloud account!</p>
           </div>
           
           <div className="w-full mt-auto relative z-10">
             <Button type="primary" size="large" icon={<RocketOutlined />} onClick={() => navigate('/pro')} className="bg-blue-600 hover:bg-blue-500 border-none shadow-lg shadow-blue-500/30 w-full text-white hover:text-white">
               Discover Pro Edition
             </Button>
           </div>
         </div>

      </div>
    </div>
  );
}
