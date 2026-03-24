import { BrowserRouter, Routes, Route } from 'react-router';
import { ConfigProvider, theme } from 'antd';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Render from './pages/Render';
import Settings from './pages/Settings';
import Pro from './pages/Pro';
import BooksDashboard from './pages/BooksDashboard';
import BookViewer from './pages/BookViewer';
import TopNavigation from './components/TopNavigation';
import { ThemeProvider, useThemeMode } from './hooks/useThemeMode';

function ThemedApp() {
  const { isDark } = useThemeMode();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: {
          Table: {
            headerBg: isDark ? '#1f2937' : '#ecfdf5', // Deep gray vs Emerald-50
            headerColor: isDark ? '#f3f4f6' : '#065f46',
            borderColor: isDark ? '#374151' : '#d1fae5',
          }
        },
        token: {
          colorPrimary: '#10b981', // emerald-500
          colorInfo: '#8b5cf6', // violet-500
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        },
      }}
    >
      <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
        <BrowserRouter>
          <TopNavigation />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<Editor />} />
              <Route path="/edit/:id" element={<Editor />} />
              <Route path="/render/:id" element={<Render />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/pro" element={<Pro />} />
              
              {/* PDF Book Engine Routes */}
              <Route path="/books" element={<BooksDashboard />} />
              <Route path="/book/:id" element={<BookViewer />} />
            </Routes>
          </div>
        </BrowserRouter>
      </div>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
