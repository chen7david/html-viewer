import { Link, useLocation } from 'react-router';
import { FileTextOutlined, ReadOutlined, SettingOutlined, RocketOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useThemeMode } from '../hooks/useThemeMode';

export default function TopNavigation() {
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeMode();

  const navItems = [
    { path: '/', label: 'HTML Engine', icon: <FileTextOutlined />, colorGroup: 'emerald' },
    { path: '/books', label: 'PDF Books', icon: <ReadOutlined />, colorGroup: 'blue' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex justify-between items-center">
        
        {/* Left Side: Main Links */}
        <div className="flex items-center gap-1 md:gap-4">
          <div className="font-extrabold text-xl tracking-tighter mr-6 hidden sm:block bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            Engine.
          </div>
          
          <div className="flex gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <div className={`
                  flex items-center gap-2 px-3 md:px-5 py-2 rounded-lg font-medium transition-all duration-200
                  ${isActive(item.path) 
                    ? `bg-${item.colorGroup}-50 text-${item.colorGroup}-700 dark:bg-${item.colorGroup}-900/30 dark:text-${item.colorGroup}-400 shadow-sm border border-${item.colorGroup}-200 dark:border-${item.colorGroup}-800/50`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 border border-transparent'
                  }
                `}>
                  {item.icon}
                  <span className="text-sm md:text-base">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/settings">
            <Button 
              type={isActive('/settings') ? "primary" : "text"} 
              icon={<SettingOutlined />} 
              className={isActive('/settings') ? "bg-gray-900 dark:bg-gray-200 dark:text-gray-900 shadow-md" : "text-gray-500 dark:text-gray-400"}
            >
              <span className="hidden md:inline">Settings</span>
            </Button>
          </Link>

          <Link to="/pro">
            <Button 
              type={isActive('/pro') ? "primary" : "default"} 
              icon={<RocketOutlined />} 
              className={isActive('/pro') 
                ? "bg-blue-600 border-none shadow-blue-500/30 shadow-lg text-white" 
                : "border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"}
            >
              <span className="hidden sm:inline">Pro</span>
            </Button>
          </Link>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block"></div>

          <Button 
            onClick={toggleTheme} 
            type="text"
            shape="circle" 
            icon={isDark ? <SunOutlined className="text-yellow-400" /> : <MoonOutlined className="text-indigo-600" />} 
          />
        </div>

      </div>
    </div>
  );
}
