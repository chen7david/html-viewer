import { HashRouter, Routes, Route } from 'react-router';
import { ConfigProvider } from 'antd';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Render from './pages/Render';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#10b981', // Emerald 500
          colorInfo: '#8b5cf6',    // Violet 500
          colorBgContainer: '#ffffff',
          colorBgLayout: '#ecfdf5', // Emerald 50
          borderRadius: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        components: {
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            colorPrimaryHover: '#059669', // Emerald 600
          },
          Table: {
            headerBg: '#f9fafb',
            headerColor: '#374151',
            borderRadius: 12,
          },
        },
      }}
    >
      <div className="min-h-screen bg-emerald-50 font-sans text-gray-800 selection:bg-purple-200 selection:text-purple-900">
        <HashRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/edit" element={<Editor />} />
            <Route path="/edit/:id" element={<Editor />} />
            <Route path="/render/:id" element={<Render />} />
          </Routes>
        </HashRouter>
      </div>
    </ConfigProvider>
  );
}

export default App;
