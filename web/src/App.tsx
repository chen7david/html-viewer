/* eslint-disable react-refresh/only-export-components */
import { HashRouter, Routes, Route } from 'react-router';
import { ConfigProvider, theme } from 'antd';
import { createContext, useContext, useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Render from './pages/Render';

export const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} });
export const useThemeContext = () => useContext(ThemeContext);

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#10b981', // emerald-500
            colorInfo: '#8b5cf6', // violet-500
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
          },
        }}
      >
        <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <HashRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<Editor />} />
              <Route path="/edit/:id" element={<Editor />} />
              <Route path="/render/:id" element={<Render />} />
            </Routes>
          </HashRouter>
        </div>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
