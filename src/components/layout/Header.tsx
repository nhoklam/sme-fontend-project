import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
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
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-600" />
          <span className="font-semibold text-gray-800 text-sm">Thông báo</span>
          {list.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold bg-primary-600 text-white rounded-full">
              {list.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {list.length > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-xs flex items-center gap-1"
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : list.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Không có thông báo mới</p>
          </div>
        ) : (
          list.map((notif: any) => {
            const style = getNotifStyle(notif.type);
            return (
              <div
                key={notif.id}
                className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => markReadMut.mutate(notif.id)}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{notif.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${style.label}`}>
                      {notif.type?.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatTimeAgo(notif.createdAt)}</span>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CheckCheck className="w-3.5 h-3.5 text-primary-400 mt-1" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {list.length > 0 && (
        <div className="px-4 py-2.5 border-t bg-gray-50 text-center">
          <span className="text-xs text-gray-400">Click vào thông báo để đánh dấu đã đọc</span>
        </div>
      )}
    </div>
  );
}

export default function Header() {
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
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="font-semibold text-gray-800 flex-1">{title}</h1>

      {/* Bell with Notification Panel */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif(v => !v)}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">
            {user?.fullName?.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-sm text-gray-700 font-medium hidden md:block">{user?.fullName}</span>
      </div>
    </header>
  );
}