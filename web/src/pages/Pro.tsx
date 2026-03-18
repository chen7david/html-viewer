import { Button } from 'antd';
import { ArrowLeftOutlined, RocketOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';

export default function Pro() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 md:p-12 relative overflow-hidden bg-white dark:bg-gray-900">
      
      {/* Background Decorators */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none" />

      <div className="max-w-2xl w-full flex flex-col items-center text-center relative z-10 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-10 md:p-16 rounded-3xl border border-white/50 dark:border-gray-700 shadow-2xl">
        <div className="bg-gradient-to-br from-purple-500 to-emerald-500 p-5 rounded-3xl shadow-lg shadow-purple-500/20 text-white mb-8 border border-white/20">
          <RocketOutlined className="text-5xl md:text-6xl drop-shadow-md" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-emerald-600 dark:from-purple-400 dark:to-emerald-400 tracking-tight mb-4">
          Coming Soon
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg mb-8">
          We are currently hard at work building the <strong>Paid Version</strong>. It will feature secure cloud accounts, persistent online-storage, full multi-device synchronization, and much more.
        </p>

        <div className="w-full flex flex-col md:flex-row gap-4 justify-center items-center">
          <Button 
            type="primary" 
            size="large" 
            icon={<MailOutlined />} 
            onClick={() => window.location.href = "mailto:entixdocs@gmail.com?subject=Early Access Interest: HTML Viewer Pro"}
            className="w-full md:w-auto bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 border-none px-8 shadow-xl transition-transform active:scale-95"
          >
            Email us for Early Access
          </Button>

          <Button 
            size="large" 
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            className="w-full md:w-auto border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:bg-transparent dark:hover:text-emerald-400 px-8 transition-colors"
          >
            Go Back
          </Button>
        </div>
        
        <div className="mt-10 text-sm opacity-80 text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-6 w-full">
          For any specific feature requests or feedback, please reach out to <a href="mailto:entixdocs@gmail.com" className="text-purple-600 dark:text-purple-400 font-medium hover:underline">entixdocs@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
