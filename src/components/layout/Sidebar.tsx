import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Package, Box, Warehouse,
  Users, DollarSign, Settings, Handshake, LogOut, 
  ArrowLeftRight, ShoppingBag, FolderTree, X
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getRoleLabel, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const navItems = [
  {
    label: 'BÁN HÀNG',
    items: [
      { icon: ShoppingCart, label: 'Bán hàng (POS)', to: '/pos', roles: ['ROLE_ADMIN','ROLE_MANAGER','ROLE_CASHIER'] },
    ]
  },
  {
    label: 'QUẢN LÝ',
    items: [
      { icon: LayoutDashboard, label: 'Tổng quan & AI', to: '/dashboard', roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: ShoppingBag,     label: 'Đơn hàng',       to: '/orders',    roles: ['ROLE_ADMIN','ROLE_MANAGER','ROLE_CASHIER'] },
      { icon: Box,             label: 'Sản phẩm',       to: '/products',  roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: FolderTree,      label: 'Danh mục',       to: '/categories',roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'KHO HÀNG',
    items: [
      { icon: Warehouse,       label: 'Tồn kho',        to: '/inventory',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: Package,         label: 'Nhập kho',       to: '/purchase-orders',  roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: ArrowLeftRight,  label: 'Chuyển kho',     to: '/transfers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'ĐỐI TÁC',
    items: [
      { icon: Users,           label: 'Khách hàng',     to: '/customers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: Handshake,       label: 'Nhà cung cấp',   to: '/suppliers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'TÀI CHÍNH',
    items: [
      { icon: DollarSign,      label: 'Sổ quỹ & Công nợ',to: '/finance',         roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'HỆ THỐNG',
    items: [
      { icon: Settings,        label: 'Cài đặt chung',  to: '/settings',         roles: ['ROLE_ADMIN','ROLE_MANAGER','ROLE_CASHIER'] },
    ]
  },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    toast.success('Đã đăng xuất hệ thống');
    navigate('/login');
  };

  const role = user?.role ?? '';

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 w-[220px] flex-shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-none",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Brand & Logo Area */}
      <div className="flex items-center justify-between px-4 h-12 md:h-14 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-slate-900 text-[14px] leading-tight tracking-tight">SME ERP</p>
          </div>
        </div>
        
        {/* Nút đóng Sidebar trên Mobile */}
        <button onClick={onClose} className="lg:hidden p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Area */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar space-y-5">
        {navItems.map((group) => {
          const visible = group.items.filter((i) => i.roles.includes(role));
          if (visible.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                {group.label}
              </p>
              {visible.map((item) => {
                // Xử lý riêng cho nút POS để nó nổi bật gọn gàng
                if (item.to === '/pos') {
                  return (
                    <button
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 mb-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-all active:scale-[0.98] group"
                    >
                      <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-[13px] tracking-wide">{item.label}</span>
                    </button>
                  );
                }

                // Các Menu thông thường (Thiết kế compact)
                return (
                  <NavLink 
                    key={item.to} 
                    to={item.to} 
                    className={({ isActive }) => cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all relative group',
                      isActive 
                        ? 'text-indigo-700 bg-indigo-50 font-bold' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
          <div className="flex flex-col min-w-0 pl-1">
            <p className="text-slate-800 text-[12px] font-bold truncate leading-tight">{user?.username}</p>
            <p className="text-slate-400 text-[10px] font-medium leading-tight">{getRoleLabel(role)}</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" 
            title="Đăng xuất"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}