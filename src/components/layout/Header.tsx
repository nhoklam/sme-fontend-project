import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notification.service';
import { formatTimeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Tổng quan & AI Co-pilot',
  '/pos':             'Bán hàng tại quầy (POS)',
  '/orders':          'Quản lý đơn hàng',
  '/products':        'Quản lý sản phẩm',
  '/categories':      'Quản lý danh mục',
  '/inventory':       'Quản lý kho',
  '/purchase-orders': 'Phiếu nhập kho',
  '/transfers':       'Phiếu chuyển kho',
  '/customers':       'Khách hàng',
  '/suppliers':       'Nhà cung cấp',
  '/finance':         'Sổ quỹ & Công nợ',
  '/reports':         'Báo cáo',
  '/settings':        'Cài đặt & Hệ thống',
};

function getNotifStyle(type: string) {
  switch (type) {
    case 'LOW_STOCK':    return { dot: 'bg-red-500',    label: 'bg-red-50 text-red-700 border-red-100' };
    case 'NEW_ORDER':    return { dot: 'bg-blue-500',   label: 'bg-blue-50 text-blue-700 border-blue-100' };
    case 'SHIFT_CLOSE':  return { dot: 'bg-purple-500', label: 'bg-purple-50 text-purple-700 border-purple-100' };
    case 'TRANSFER':     return { dot: 'bg-amber-500',  label: 'bg-amber-50 text-amber-700 border-amber-100' };
    default:             return { dot: 'bg-gray-400',   label: 'bg-gray-50 text-gray-600 border-gray-100' };
  }
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationService.getUnread().then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-unread'] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      toast.success('Đã đánh dấu tất cả là đã đọc');
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const list = notifications ?? [];

  return (
    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-slate-800 text-[13px]">Thông báo</span>
          {list.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
              {list.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {list.length > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-1"
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
        {isLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">Đang tải...</div>
        ) : list.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-medium">Không có thông báo mới</p>
          </div>
        ) : (
          list.map((notif: any) => {
            const style = getNotifStyle(notif.type);
            return (
              <div
                key={notif.id}
                className="flex gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                onClick={() => markReadMut.mutate(notif.id)}
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 leading-tight">{notif.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${style.label}`}>
                      {notif.type?.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">{formatTimeAgo(notif.createdAt)}</span>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-400 mt-1" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.countUnread().then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const title = PAGE_TITLES[pathname] ?? 'SME ERP & POS';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 md:h-14 bg-white border-b border-slate-200 flex items-center px-3 md:px-6 gap-3 flex-shrink-0 sticky top-0 z-30">
      
      {/* Nút Menu Hamburger chỉ hiện trên Mobile/Tablet */}
      <button 
        onClick={onMenuClick} 
        className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="font-bold text-slate-800 text-[15px] md:text-base flex-1 truncate tracking-tight">{title}</h1>

      <div className="flex items-center gap-3 shrink-0">
        {/* Bell with Notification Panel */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(v => !v)}
            className="relative p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none border border-white">
                {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-[11px] font-bold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:flex flex-col min-w-0">
            <span className="text-[12px] text-slate-800 font-bold truncate leading-tight">{user?.fullName}</span>
            <span className="text-[10px] text-slate-400 font-medium truncate leading-tight">{user?.warehouseName ?? 'Quản trị viên'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}