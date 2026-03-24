import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button, message, Upload, Switch, Spin, Select, Tabs } from 'antd';
import { DownloadOutlined, UploadOutlined, RocketOutlined, ApiOutlined } from '@ant-design/icons';
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
  const [isExportingBooks, setIsExportingBooks] = useState(false);
  const [aiSettings, setAiSettings] = useState(SettingsRepository.getAiSettings());
  const [availableModels, setAvailableModels] = useState<{label: string, value: string}[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showAdvancedNetwork, setShowAdvancedNetwork] = useState(false);

  // Poll for models whenever endpoint/key changes using Universal OpenAI Standard
  useEffect(() => {
    if (aiSettings.activeProvider === 'openwebui' && aiSettings.openWebUiEndpoint) {
       const fetchModels = async () => {
          setIsFetchingModels(true);
          try {
             // Derive base URL by removing the default OpenAI proxy target suffix
             const baseUrl = aiSettings.openWebUiEndpoint.replace('/chat/completions', '').replace(/\/+$/, '');
             const response = await fetch(`${baseUrl}/models`, {
                headers: aiSettings.openWebUiApiKey ? { 'Authorization': `Bearer ${aiSettings.openWebUiApiKey}` } : {}
             });
             if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                   setAvailableModels(data.data.map((m: any) => ({ label: m.id, value: m.id })));
                }
             }
          } catch (e) {
             console.error("OpenWebUI Model Fetch Error:", e);
          } finally {
             setIsFetchingModels(false);
          }
       };
       
       const timeout = setTimeout(fetchModels, 800); // 800ms debounce
       return () => clearTimeout(timeout);
    }
  }, [aiSettings.activeProvider, aiSettings.openWebUiEndpoint, aiSettings.openWebUiApiKey]);

  const handleExportAll = async () => {
    setIsExportingBooks(true);
    message.loading({ content: 'Assembling complete system backup...', key: 'exportAll' });
    try {
      const fullBooks = await BookRepository.getAllFullBooks();
      const payload = {
        htmlDocuments: documents,
        pdfBooks: fullBooks
      };
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `universal_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success({ content: 'System Data exported successfully!', key: 'exportAll' });
    } catch (err) {
      message.error({ content: 'Failed to export massive system files.', key: 'exportAll' });
    } finally {
      setIsExportingBooks(false);
    }
  };

  const handleImportAll = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      message.loading({ content: 'Restoring universal system data...', key: 'importAll' });
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        
        let htmlPayload: HtmlDocument[] = [];
        let pdfPayload: StoredBook[] = [];

        if (parsed.htmlDocuments || parsed.pdfBooks) {
          htmlPayload = parsed.htmlDocuments || [];
          pdfPayload = parsed.pdfBooks || [];
        } else if (Array.isArray(parsed)) {
          // Fallback for legacy split-backups
          if (parsed.length > 0 && parsed[0].id && !parsed[0].book) {
             htmlPayload = parsed as HtmlDocument[];
          } else if (parsed.length > 0 && parsed[0].book) {
             pdfPayload = parsed as StoredBook[];
          }
        }

        if (htmlPayload.length > 0) {
           importDocuments(htmlPayload, isMergingHtml);
        }

        if (pdfPayload.length > 0) {
           if (!isMergingBooks) {
             const existing = await BookRepository.getAllBookSummaries();
             for (const b of existing) {
               await BookRepository.deleteBook(b.id);
             }
           }
           await BookRepository.saveMultipleBooks(pdfPayload);
        }

        message.success({ content: `Successfully restored ${htmlPayload.length} HTML docs and ${pdfPayload.length} PDF books!`, key: 'importAll' });
      } catch (err) {
        console.error(err);
        message.error({ content: 'Failed to parse the JSON backup file. Ensure it is a valid export.', key: 'importAll' });
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleSaveAiSettings = () => {
    SettingsRepository.saveAiSettings(aiSettings);
    message.success('AI Configuration securely updated and saved to local storage!');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-400 mb-2">
            System Settings
          </h1>
          <p className="text-emerald-700 dark:text-emerald-500 max-w-2xl text-sm md:text-base leading-relaxed">
            <strong>The local client is 100% free, forever.</strong> Everything operates safely within your browser's local sandbox. Configure your preferred Universal AI Extraction hardware node, or meticulously export your massive libraries to physical persistence perfectly securely.
          </p>
        </div>
        <div></div>
      </div>

      <Tabs 
        defaultActiveKey="storage"
        size="large"
        className="[&_.ant-tabs-nav]:mb-8 [&_.ant-tabs-tab]:text-lg [&_.ant-tabs-tab]:font-bold [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-emerald-600 dark:[&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-emerald-400 [&_.ant-tabs-ink-bar]:bg-emerald-600 dark:[&_.ant-tabs-ink-bar]:bg-emerald-400"
        items={[
          {
            key: 'ai',
            label: 'Global AI Setup',
            children: (
              <div className="flex flex-col items-start gap-8 w-full max-w-5xl py-4 pb-12">
           <div className="flex items-center gap-4 w-full border-b border-gray-200 dark:border-gray-700 pb-6">
              <div className="bg-orange-100 dark:bg-orange-900/40 p-4 rounded-full text-orange-600 dark:text-orange-400 flex items-center justify-center">
                 <ApiOutlined className="text-3xl" />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-gray-900 dark:text-white m-0">Global AI Pipeline</h2>
                 <p className="text-gray-500 dark:text-gray-400 text-sm m-0">Select your extraction infrastructure node.</p>
              </div>
           </div>

           <div className="w-full flex items-center gap-4">
              <span className="font-bold text-gray-700 dark:text-gray-300">Active Routing Node:</span>
              <Select
                value={aiSettings.activeProvider}
                onChange={(val) => setAiSettings({...aiSettings, activeProvider: val as any})}
                className="flex-1 max-w-sm h-14 shadow-sm [&_.ant-select-selector]:h-14 [&_.ant-select-selection-item]:flex [&_.ant-select-selection-item]:items-center [&_.ant-select-selector]:rounded-2xl [&_.ant-select-selection-item]:font-bold [&_.ant-select-selection-item]:text-lg [&_.ant-select-selector]:border-orange-300 dark:[&_.ant-select-selector]:border-orange-500/30 dark:[&_.ant-select-selector]:bg-gray-900"
                options={[
                  { label: 'Cloud: Google Gemini', value: 'gemini' },
                  { label: 'Local: Custom Open WebUI', value: 'openwebui' }
                ]}
              />
           </div>

           <div className="flex-1 w-full flex flex-col mt-2">
             {aiSettings.activeProvider === 'gemini' ? (
               <>
                 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Google Gemini Configuration</h2>
                 <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed mb-8 max-w-4xl">
                   To utilize advanced semantic formatting of PDF Books (cleaning up covers, headers, and footers), you must provide your own <strong>Google AI Studio API Key</strong>. Because this app is fully native, our engine code executes the API calls entirely within the safety of your own browser—we have no backend servers.
                 </p>
                 <div className="flex items-center gap-4 mt-auto max-w-4xl w-full">
                   <input 
                     type="password" 
                     value={aiSettings.geminiApiKey} 
                     onChange={(e) => setAiSettings({...aiSettings, geminiApiKey: e.target.value})} 
                     placeholder="Paste your Gemini API Key here (AIzaSy...)" 
                     className="flex-1 w-full text-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner px-6 py-4 focus:outline-none focus:ring-4 ring-orange-400/30 transition-all"
                   />
                 </div>
               </>
             ) : (
               <>
                 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Universal Local Routing</h2>
                 <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed mb-6 max-w-4xl">
                   <strong>OpenAI-Compatible Network Stream.</strong> Direct your AI Extraction tasks to any OpenAI-compatible custom network node, such as an Open WebUI local model array, an Ollama cloud server, or a securely hardened Cloudflare Worker proxy array to maintain immense privacy boundaries.
                 </p>
                 
                 {!showAdvancedNetwork ? (
                    <div className="mt-4 flex flex-col items-start w-full bg-orange-50 dark:bg-gray-900/50 rounded-2xl p-6 border border-orange-100 dark:border-gray-700">
                       <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Deploy Custom Universal Hub</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">You have opted to bypass cloud structures. Expose your Universal Endpoint, Hardware Models, and proxy API Keys under 'Advanced Configure'.</p>
                       <Button size="large" type="default" onClick={() => setShowAdvancedNetwork(true)} className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 font-bold px-8 h-12 rounded-xl shadow-sm">
                          Configure Advanced AI Node
                       </Button>
                    </div>
                 ) : (
                   <div className="flex flex-col gap-5 mt-auto max-w-4xl w-full p-6 bg-gray-50 dark:bg-gray-900/60 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-inner">
                     <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Target Extractor IP / URL</span>
                        <Button type="link" onClick={() => setShowAdvancedNetwork(false)} className="text-gray-400 hover:text-red-500 p-0 m-0 h-auto">Hide Settings</Button>
                     </div>
                     <input 
                       type="text" 
                       value={aiSettings.openWebUiEndpoint} 
                       onChange={(e) => setAiSettings({...aiSettings, openWebUiEndpoint: e.target.value})} 
                       placeholder="Endpoint URL (e.g. https://api.my-cloudflare-worker.com/v1/chat/completions)" 
                       className="w-full text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 focus:outline-none focus:ring-4 ring-orange-400/30 transition-all h-[56px]"
                     />
                     <div className="flex flex-col gap-5 mt-2">
                       <div className="flex-1 flex flex-col">
                         <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Node Hardware Model Request</span>
                         {availableModels.length > 0 ? (
                           <Select 
                            showSearch
                            value={aiSettings.openWebUiModelId || undefined} 
                            onChange={(val) => setAiSettings({...aiSettings, openWebUiModelId: val})} 
                            placeholder="Select Node Execution Model" 
                            className="w-full h-[56px] shadow-sm [&_.ant-select-selector]:!h-[56px] [&_.ant-select-selection-search-input]:!h-[56px] [&_.ant-select-selection-item]:!leading-[54px] [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-gray-200 dark:[&_.ant-select-selector]:!border-gray-700 dark:[&_.ant-select-selector]:!bg-gray-800 dark:[&_.ant-select-selection-item]:!text-white text-base"
                            options={availableModels}
                          />
                         ) : (
                           <input 
                             type="text" 
                             value={aiSettings.openWebUiModelId || ''} 
                             onChange={(e) => setAiSettings({...aiSettings, openWebUiModelId: e.target.value})} 
                             placeholder={isFetchingModels ? "Fetching hardware clusters..." : "Model ID (e.g. glm-4...)"} 
                             className="w-full text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 focus:outline-none focus:ring-4 ring-orange-400/30 transition-all h-[56px]"
                           />
                         )}
                       </div>
                       <div className="flex-1 flex flex-col">
                         <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Proxy Node / Model API Key</span>
                         <input 
                           type="password" 
                           value={aiSettings.openWebUiApiKey} 
                           onChange={(e) => setAiSettings({...aiSettings, openWebUiApiKey: e.target.value})} 
                           placeholder="API Key / Optional Bearer Hub Token" 
                           className="w-full text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-4 focus:outline-none focus:ring-4 ring-orange-400/30 transition-all h-[56px]"
                         />
                       </div>
                     </div>
                   </div>
                 )}
               </>
             )}

             <div className="pt-8">
                <Button type="primary" size="large" onClick={handleSaveAiSettings} className="bg-orange-600 hover:bg-orange-500 shadow-xl shadow-orange-500/20 px-10 h-14 rounded-2xl text-lg font-bold">
                  Deploy API Pipeline
                </Button>
             </div>
           </div>
        </div>
            )
          },
          {
            key: 'storage',
            label: 'Local Storage Data',
            children: (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8 items-stretch">
         {/* Universal Export Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-emerald-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-full text-emerald-600 dark:text-emerald-400">
             <DownloadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Export Full System</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Download a complete universal JSON payload of your entire workspace, encapsulating both HTML documents and parsed IndexedDB PDF Books.</p>
           </div>
           
           <div className="w-full mt-auto pt-6">
             <Button type="primary" size="large" onClick={handleExportAll} disabled={isExportingBooks} icon={isExportingBooks ? <Spin size="small" /> : <DownloadOutlined />} className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 w-full disabled:bg-gray-400">
               {isExportingBooks ? "Assembling Core..." : "Export Full Backup (.json)"}
             </Button>
           </div>
         </div>

         {/* Universal Import Card */}
         <div className="bg-white/90 dark:bg-gray-800/90 shadow-xl shadow-purple-900/5 dark:shadow-none rounded-2xl p-8 border border-white/50 dark:border-gray-700 flex flex-col items-start gap-4 h-full">
           <div className="bg-purple-100 dark:bg-purple-900/40 p-3 rounded-full text-purple-600 dark:text-purple-400">
             <UploadOutlined className="text-2xl" />
           </div>
           <div className="flex-1 w-full flex flex-col">
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Restore Full System</h2>
             <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">Restore a massive payload covering both your AI PDF libraries and your offline HTML workspace structures. Safely backward compatible with older segmented exports.</p>
             
             <div className="mt-auto flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 w-full shadow-sm mb-2">
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">Merge Data</span>
                <Switch 
                  checked={!isMergingHtml} 
                  onChange={(checked) => { setIsMergingHtml(!checked); setIsMergingBooks(!checked); }} 
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
               beforeUpload={handleImportAll}
               className="w-full block [&_.ant-upload]:w-full"
             >
               <Button type="primary" size="large" icon={<UploadOutlined />} className="bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20 w-full">
                 Import Universal Backup
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
            )
          }
        ]}
      />
    </div>
  );
}
