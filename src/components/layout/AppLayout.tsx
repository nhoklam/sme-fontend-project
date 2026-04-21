import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Tự động đóng Sidebar trên Mobile mỗi khi chuyển trang
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      
      {/* Mobile Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Truyền state đóng/mở xuống Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Truyền event mở Sidebar lên Header */}
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        {/* Tận dụng diện tích: giảm padding trên mobile */}
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}