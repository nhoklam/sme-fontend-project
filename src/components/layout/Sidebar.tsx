import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, LayoutDashboard, Package, Box, Warehouse,
  Users, DollarSign, BarChart2, Settings, Handshake,
  ChevronRight, LogOut, ArrowLeftRight, ShoppingBag
} from 'lucide-react';
import { FolderTree } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getRoleLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const navItems = [
  {
    label: 'MODULE 0',
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
      { icon: FolderTree,      label: 'Danh mục',       to: '/categories',roles: ['ROLE_ADMIN','ROLE_MANAGER'] }, // Dòng mới thêm
    ]
  },
  {
    label: 'KHO',
    items: [
      { icon: Warehouse,       label: 'Tồn kho',           to: '/inventory',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: Package,         label: 'Nhập kho',          to: '/purchase-orders',  roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: ArrowLeftRight,  label: 'Chuyển kho',        to: '/transfers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'ĐỐI TÁC',
    items: [
      { icon: Users,           label: 'Khách hàng',        to: '/customers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: Handshake,       label: 'Nhà cung cấp',      to: '/suppliers',        roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'TÀI CHÍNH',
    items: [
      { icon: DollarSign,      label: 'Sổ quỹ & Công nợ',  to: '/finance',          roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
      { icon: BarChart2,       label: 'Báo cáo',           to: '/reports',          roles: ['ROLE_ADMIN','ROLE_MANAGER'] },
    ]
  },
  {
    label: 'HỆ THỐNG',
    items: [
      { icon: Settings,        label: 'Cài đặt',           to: '/settings',         roles: ['ROLE_ADMIN','ROLE_MANAGER','ROLE_CASHIER'] },
    ]
  },
];

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    toast.success('Đã đăng xuất');
    navigate('/login');
  };

  const role = user?.role ?? '';

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
      style={{ backgroundColor: '#0f2b5b' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm leading-tight">SME ERP & POS</p>
          <p className="text-white/50 text-xs truncate">{user?.warehouseName ?? 'Tất cả chi nhánh'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((group) => {
          const visible = group.items.filter((i) => i.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                {group.label}
              </p>
              {visible.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn('sidebar-item', isActive && 'active')
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.fullName}</p>
            <p className="text-white/40 text-[11px]">{getRoleLabel(role)}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-white transition-colors p-1"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
