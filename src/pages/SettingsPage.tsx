import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Warehouse, Bot, UserCheck, UserX, Plus, Upload, FileText,
  Trash2, Eye, Edit, Search, Filter, Lock, Phone, Clock,
  Shield, User2, History, ChevronDown, CheckCircle2, Mail
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { warehouseService } from '@/services/warehouse.service';
import { aiService, KnowledgeDocument } from '@/services/ai.service';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatDateTime, getRoleLabel, getRoleColor } from '@/lib/utils';
import { PageLoader, Spinner, ConfirmDialog, EmptyState } from '@/components/ui';
import toast from 'react-hot-toast';
import type { AuditLogResponse } from '@/types';

// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE ROOT
// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isAdmin, user } = useAuthStore();
  
  const defaultTab = isAdmin() ? 'users' : 'password';
  const [tab, setTab] = useState<'users' | 'warehouses' | 'ai' | 'audit' | 'password'>(defaultTab as any);

  const tabs = [
    { id: 'users',      label: 'Quản lý nhân sự',  icon: Users,   show: isAdmin() }, 
    { id: 'warehouses', label: 'Chi nhánh',        icon: Warehouse, show: isAdmin() }, 
    { id: 'ai',         label: 'Dữ liệu AI',       icon: Bot,     show: isAdmin() }, 
    { id: 'audit',      label: 'Nhật ký hệ thống', icon: History, show: isAdmin() }, 
    { id: 'password',   label: 'Bảo mật',          icon: Lock,    show: true },      
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-8 font-sans pb-16 max-w-[1600px] mx-auto">
      
      {/* HEADER TỔNG */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Quản lý tài khoản, phân quyền và cấu hình toàn hệ thống.</p>
        </div>
      </div>

      {/* TABS NAVIGATION THIẾT KẾ THANH LỊCH */}
      <div className="border-b border-slate-200/80 overflow-x-auto no-scrollbar">
        <div className="flex gap-8 min-w-max pb-[1px]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 pb-4 text-sm font-semibold transition-all relative ${
                  isActive 
                    ? 'text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {t.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-fade-in">
        {tab === 'users'      && <UsersTab />}
        {tab === 'warehouses' && <WarehousesTab />}
        {tab === 'ai'         && <AIDocumentsTab />}
        {tab === 'audit'      && <AuditLogsTab />}
        {tab === 'password'   && <ChangePasswordTab user={user} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1: USERS (QUẢN LÝ NHÂN SỰ)
// ─────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ keyword: '', role: '', warehouseId: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    username: '', password: '', fullName: '', email: '', phone: '', role: 'ROLE_CASHIER', warehouseId: '',
  });
  const [showLastLogin, setShowLastLogin] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));
      return authService.getUsers(cleanFilters).then(r => r.data.data);
    },
  });

  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehouseService.getAll().then(r => r.data.data) });
  const { data: allManagers } = useQuery({ queryKey: ['users-managers'], queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data) });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => active ? authService.activateUser(id) : authService.deactivateUser(id),
    onSuccess: () => { toast.success('Đã cập nhật trạng thái'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = { ...form };
      if (!payload.warehouseId) payload.warehouseId = null;
      if (editing && !payload.password) delete payload.password;
      return editing ? authService.updateUser(editing.id, payload) : authService.createUser(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật tài khoản thành công' : 'Tạo tài khoản thành công');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-managers'] }); 
      handleCloseModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi lưu tài khoản'),
  });

  const handleOpenModal = (user?: any) => {
    if (user) {
      setEditing(user);
      setForm({ username: user.username, password: '', fullName: user.fullName, email: user.email ?? '', phone: user.phone ?? '', role: user.role, warehouseId: user.warehouseId ?? '' });
    } else {
      setEditing(null);
      setForm({ username: '', password: '', fullName: '', email: '', phone: '', role: 'ROLE_CASHIER', warehouseId: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditing(null);
  };

  const availableWarehouses = useMemo(() => {
    if (!warehouses) return [];
    if (form.role === 'ROLE_MANAGER') {
      const occupiedWarehouseIds = new Set((allManagers ?? []).filter((m: any) => m.warehouseId && m.id !== editing?.id).map((m: any) => m.warehouseId));
      return warehouses.filter((w: any) => !occupiedWarehouseIds.has(w.id));
    }
    return warehouses;
  }, [warehouses, form.role, allManagers, editing]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* FILTER BAR - CLEAN UI */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white p-5 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[200px] lg:max-w-xs group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal placeholder:text-slate-400"
              placeholder="Tìm tên, username, email..."
              value={filters.keyword}
              onChange={e => setFilters(p => ({ ...p, keyword: e.target.value }))}
            />
          </div>
          
          <div className="relative w-40 group">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500" />
            <select 
              className="w-full pl-10 pr-8 py-2.5 text-sm font-semibold text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
              value={filters.role} 
              onChange={e => setFilters(p => ({ ...p, role: e.target.value }))}
            >
              <option value="">Mọi vai trò</option>
              <option value="ROLE_ADMIN">Admin</option>
              <option value="ROLE_MANAGER">Quản lý</option>
              <option value="ROLE_CASHIER">Thu ngân</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative w-52 group">
            <Warehouse className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500" />
            <select 
              className="w-full pl-10 pr-8 py-2.5 text-sm font-semibold text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
              value={filters.warehouseId} 
              onChange={e => setFilters(p => ({ ...p, warehouseId: e.target.value }))}
            >
              <option value="">Mọi chi nhánh</option>
              {(warehouses ?? []).map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowLastLogin(v => !v)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${
              showLastLogin 
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/50' 
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {showLastLogin ? 'Ẩn đăng nhập' : 'Lịch sử đăng nhập'}
          </button>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shrink-0 w-full lg:w-auto justify-center">
          <Plus className="w-4 h-4" /> Thêm nhân sự
        </button>
      </div>

      {/* BẢNG DỮ LIỆU - GOLDEN RATIO */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-5">Nhân sự</th>
                <th className="px-6 py-5">Tài khoản</th>
                <th className="px-6 py-5">Liên hệ</th>
                <th className="px-6 py-5">Phân quyền</th>
                <th className="px-6 py-5">Nơi làm việc</th>
                {showLastLogin && <th className="px-6 py-5">Đăng nhập cuối</th>}
                <th className="px-6 py-5">Trạng thái</th>
                <th className="px-6 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(users ?? []).length === 0 ? (
                <tr><td colSpan={showLastLogin ? 8 : 7} className="text-center py-16 text-slate-400 font-medium">Không tìm thấy nhân sự phù hợp.</td></tr>
              ) : (
                (users ?? []).map((u: any) => (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors group ${!u.isActive ? 'bg-slate-50/50 opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100/50">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.fullName}</p>
                          {u.email && <p className="text-xs text-slate-500 font-medium mt-0.5">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 font-medium">{u.username}</td>
                    <td className="px-6 py-4 text-slate-600">{u.phone ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                        u.role === 'ROLE_ADMIN' ? 'bg-purple-50 text-purple-700' :
                        u.role === 'ROLE_MANAGER' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-semibold">{u.warehouseName ?? 'Toàn hệ thống'}</td>
                    {showLastLogin && (
                      <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-slate-300">Chưa đăng nhập</span>}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(u)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" title="Chỉnh sửa">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleMut.mutate({ id: u.id, active: !u.isActive })}
                          className={`p-2 rounded-lg transition-colors ${u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={u.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
                        >
                          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL THÊM/SỬA NHÂN SỰ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-scale-in">
            <h3 className="font-bold text-xl text-slate-900 mb-6">{editing ? 'Cập nhật hồ sơ nhân sự' : 'Tạo tài khoản mới'}</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tên đăng nhập *</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="VD: nguyenvan_a" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} disabled={!!editing} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu {!editing && '*'}</label>
                  <input type="password" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder={editing ? 'Bỏ trống để giữ nguyên' : 'Tối thiểu 8 ký tự'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Họ và tên *</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="VD: Nguyễn Văn A" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="VD: nva@congty.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số điện thoại</label>
                  <input type="tel" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="VD: 0912345678" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Phân quyền *</label>
                  <select 
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none appearance-none cursor-pointer" 
                    value={form.role} 
                    onChange={e => {
                      const newRole = e.target.value;
                      setForm(p => {
                        let newWid = p.warehouseId;
                        if (newRole === 'ROLE_ADMIN') newWid = '';
                        if (newRole === 'ROLE_MANAGER' && p.role === 'ROLE_CASHIER') newWid = ''; 
                        return { ...p, role: newRole, warehouseId: newWid };
                      });
                    }}
                  >
                    <option value="ROLE_ADMIN">Quản trị viên (Admin)</option>
                    <option value="ROLE_MANAGER">Quản lý chi nhánh</option>
                    <option value="ROLE_CASHIER">Nhân viên Thu ngân</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-[34px] w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nơi làm việc</label>
                  <select 
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none appearance-none cursor-pointer disabled:opacity-50" 
                    value={form.warehouseId} 
                    onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))} 
                    disabled={form.role === 'ROLE_ADMIN'}
                  >
                    <option value="">-- {form.role === 'ROLE_ADMIN' ? 'Toàn hệ thống' : 'Chọn chi nhánh'} --</option>
                    {availableWarehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-[34px] w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={handleCloseModal} className="w-full px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">
                Hủy bỏ
              </button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.username || (!editing && !form.password) || !form.fullName}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saveMut.isPending ? <Spinner size="sm" className="text-white" /> : (editing ? 'Lưu thay đổi' : 'Tạo tài khoản')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: WAREHOUSES (CHI NHÁNH)
// ─────────────────────────────────────────────────────────────
function WarehousesTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', provinceCode: '', address: '', phone: '', managerId: '' });

  const { data: warehouses, isLoading } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehouseService.getAll().then(r => r.data.data) });
  const { data: managers } = useQuery({ queryKey: ['users-managers'], queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data) });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = { ...form };
      if (!payload.managerId) payload.managerId = null;
      return editing ? warehouseService.update(editing.id, payload) : warehouseService.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật chi nhánh thành công!' : 'Thêm chi nhánh thành công!');
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      handleCloseModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi lưu chi nhánh'),
  });

  const deactivateMut = useMutation({ mutationFn: (id: string) => warehouseService.deactivate(id), onSuccess: () => { toast.success('Đã ngừng hoạt động'); qc.invalidateQueries({ queryKey: ['warehouses'] }); } });
  const activateMut = useMutation({ mutationFn: (id: string) => warehouseService.activate(id), onSuccess: () => { toast.success('Đã khôi phục'); qc.invalidateQueries({ queryKey: ['warehouses'] }); } });

  const handleOpenModal = (warehouse?: any) => {
    if (warehouse) {
      setEditing(warehouse);
      setForm({ code: warehouse.code, name: warehouse.name, provinceCode: warehouse.provinceCode, address: warehouse.address ?? '', phone: warehouse.phone ?? '', managerId: warehouse.managerId ?? '' });
    } else {
      setEditing(null);
      setForm({ code: '', name: '', provinceCode: '', address: '', phone: '', managerId: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setEditing(null); };

  const managerMap = new Map<string, string>();
  (managers ?? []).forEach((m: any) => managerMap.set(m.id, m.fullName));

  const availableManagers = useMemo(() => {
    if (!managers || !warehouses) return [];
    const usedManagerIds = new Set(warehouses.filter((w: any) => w.managerId && w.id !== editing?.id).map((w: any) => w.managerId));
    return managers.filter((m: any) => !usedManagerIds.has(m.id));
  }, [managers, warehouses, editing]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Thêm chi nhánh
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-5">Mã</th>
                <th className="px-6 py-5">Tên chi nhánh</th>
                <th className="px-6 py-5">Tỉnh/TP</th>
                <th className="px-6 py-5">Địa chỉ & Liên hệ</th>
                <th className="px-6 py-5">Quản lý</th>
                <th className="px-6 py-5">Trạng thái</th>
                <th className="px-6 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(warehouses ?? []).length === 0 ? (
                 <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">Chưa có chi nhánh nào.</td></tr>
              ) : (
                (warehouses ?? []).map((w: any) => (
                  <tr key={w.id} className={`hover:bg-slate-50/80 transition-colors group ${!w.isActive ? 'bg-slate-50/50 opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md font-mono font-bold text-slate-700">{w.code}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-base">{w.name}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">{w.provinceCode}</td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800 text-sm max-w-[250px] truncate">{w.address ?? 'Chưa cập nhật địa chỉ'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{w.phone ?? '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {w.managerId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100">
                          <User2 className="w-3 h-3" />
                          {managerMap.get(w.managerId) ?? w.managerId.slice(0,8)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm italic">Chưa chỉ định</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        w.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {w.isActive ? 'Hoạt động' : 'Đã đóng cửa'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(w)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" title="Sửa thông tin">
                          <Edit className="w-4 h-4" />
                        </button>
                        {w.isActive ? (
                          <button onClick={() => { if (window.confirm('Ngừng hoạt động chi nhánh này?')) deactivateMut.mutate(w.id); }}
                            className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors" title="Đóng cửa" disabled={deactivateMut.isPending}>
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => { if (window.confirm('Khôi phục hoạt động chi nhánh này?')) activateMut.mutate(w.id); }}
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="Mở lại" disabled={activateMut.isPending}>
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL THÊM/SỬA CHI NHÁNH */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-scale-in">
            <h3 className="font-bold text-xl text-slate-900 mb-6">{editing ? 'Sửa thông tin chi nhánh' : 'Khai báo chi nhánh mới'}</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã định danh *</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none disabled:opacity-50" placeholder="VD: HCM-01" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} disabled={!!editing} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã vùng (Tỉnh/TP) *</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="VD: 79" value={form.provinceCode} onChange={e => setForm(p => ({ ...p, provinceCode: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tên chi nhánh *</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="VD: Cửa hàng Trung tâm Q1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus={!editing} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số điện thoại</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" placeholder="Điện thoại CSKH..." value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quản lý trực tiếp</label>
                  <select 
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none appearance-none cursor-pointer" 
                    value={form.managerId} 
                    onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
                  >
                    <option value="">-- Chưa bổ nhiệm --</option>
                    {availableManagers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-[34px] w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Địa chỉ cụ thể</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none" rows={2} placeholder="Số nhà, tên đường, phường/xã..." value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={handleCloseModal} className="w-full px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">Hủy bỏ</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.code || !form.name || !form.provinceCode} className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 flex justify-center items-center">
                {saveMut.isPending ? <Spinner size="sm" className="text-white" /> : (editing ? 'Lưu thay đổi' : 'Mở chi nhánh')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3: AI DOCUMENTS (DỮ LIỆU AI)
// ─────────────────────────────────────────────────────────────
function AIDocumentsTab() {
  const [uploading, setUploading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [docToView, setDocToView] = useState<KnowledgeDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [topK, setTopK] = useState(5);
  const qc = useQueryClient();

  const { data: documents, isLoading } = useQuery({ queryKey: ['ai-documents'], queryFn: () => aiService.getDocuments().then(r => r.data.data) });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiService.deleteDocument(id),
    onSuccess: () => { toast.success('Đã làm sạch dữ liệu AI'); qc.invalidateQueries({ queryKey: ['ai-documents'] }); setDocToDelete(null); },
    onError: () => toast.error('Lỗi khi xóa tài liệu'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await aiService.uploadDocument(file, file.name);
      toast.success(`Học thành công: ${res.data.data.chunkCount ?? 'nhiều'} đoạn kiến thức`);
      qc.invalidateQueries({ queryKey: ['ai-documents'] });
    } catch {
      toast.error('Lỗi upload tài liệu');
    } finally {
      setUploading(false); e.target.value = '';
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await aiService.searchSemantic(searchQuery, topK);
      setSearchResults(res.data.data);
      if (res.data.data.length === 0) toast('Không tìm thấy ngữ nghĩa phù hợp', { icon: '🔍' });
    } catch { toast.error('Lỗi tìm kiếm AI'); } finally { setSearching(false); }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      
      {/* DROPZONE CAO CẤP */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/80 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors group relative">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100 mb-4 group-hover:scale-110 transition-transform">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Huấn luyện AI Bán hàng</h3>
          <p className="text-slate-500 mt-1.5 max-w-md mx-auto text-sm">
            Tải lên các tài liệu PDF, DOCX, TXT chứa Chính sách, Cẩm nang sản phẩm, Quy trình để Trợ lý AI học và tư vấn cho nhân viên.
          </p>
          <label className={`mt-6 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-all cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
            {uploading ? <><Spinner size="sm" className="text-white" /> Đang xử lý ngôn ngữ tự nhiên...</> : <><Upload className="w-4 h-4" /> Chọn tài liệu tải lên</>}
            <input type="file" accept=".pdf,.docx,.doc,.txt,.pptx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEARCH RAG (KIỂM THỬ) */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" /> Kiểm thử trí thông minh (RAG)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Tìm kiếm theo ngữ nghĩa để xem AI hiểu tài liệu thế nào.</p>
            </div>
            <span className="bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">Testing</span>
          </div>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <input
                className="w-full pl-4 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                placeholder="Hỏi AI: Chính sách trả hàng quá 7 ngày..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSemanticSearch()}
              />
            </div>
            <div className="relative w-24">
              <select className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                <option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-[13px] w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={handleSemanticSearch} disabled={searching || !searchQuery.trim()} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-50">
              {searching ? <Spinner size="sm" className="text-white" /> : 'Tìm'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[300px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
            {!searchResults ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">Kết quả tìm kiếm sẽ hiển thị tại đây</div>
            ) : searchResults.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">Không tìm thấy dữ liệu. Hãy dạy thêm cho AI.</div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((result: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">Trích đoạn #{idx + 1}</span>
                      {result.score !== undefined && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          Độ tin cậy: {(result.score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{result.content ?? result.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DANH SÁCH TÀI LIỆU */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Thư viện tri thức hiện hành</h3>
            <p className="text-xs text-slate-500 mt-1">Các tài liệu AI đang sử dụng làm căn cứ tư vấn.</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[450px]">
             <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                <tr><th className="px-6 py-4">Tài liệu</th><th className="px-6 py-4 text-center">Đoạn (Chunks)</th><th className="px-6 py-4 text-right">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80">
                {(documents ?? []).length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-16 text-slate-400 font-medium">Chưa có tri thức nào.</td></tr>
                ) : (
                  (documents ?? []).map((doc: KnowledgeDocument) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{doc.title}</span>
                          <span className="text-xs text-slate-400 mt-0.5">{formatDateTime(doc.createdAt)} • <span className="uppercase font-mono font-bold text-slate-500">{doc.fileType}</span></span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex bg-indigo-50 text-indigo-700 font-black text-sm px-3 py-1 rounded-lg border border-indigo-100">{doc.chunkCount}</span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDocToView(doc)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Xem chi tiết">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDocToDelete(doc.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" title="Xóa tài liệu">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {docToView && <DocumentDetailsModal doc={docToView} onClose={() => setDocToView(null)} />}

      <ConfirmDialog
        open={!!docToDelete}
        title="Xóa tri thức AI"
        description="Bạn có chắc chắn muốn xóa tài liệu này? Mọi hiểu biết (Vector data) của AI về tài liệu này sẽ bị xóa vĩnh viễn khỏi hệ thống."
        danger={true}
        onConfirm={() => deleteMut.mutate(docToDelete!)}
        onCancel={() => setDocToDelete(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function DocumentDetailsModal({ doc, onClose }: { doc: KnowledgeDocument; onClose: () => void }) {
  const { data: chunks, isLoading } = useQuery({ queryKey: ['ai-document-chunks', doc.id], queryFn: () => aiService.getDocumentChunks(doc.id).then(r => r.data.data) });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 max-h-[85vh] flex flex-col animate-scale-in">
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-xl text-slate-900">{doc.title}</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Định dạng <span className="uppercase text-slate-700">{doc.fileType}</span> • Học vào {formatDateTime(doc.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <div className="sticky top-0 bg-white/90 backdrop-blur pb-3 flex justify-between items-center z-10">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              Dữ liệu Vector đã lưu ({doc.chunkCount} đoạn)
            </h4>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : chunks?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">Chưa tải được nội dung.</p>
          ) : (
            <div className="space-y-4">
              {chunks?.map((content, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl text-sm text-slate-700 leading-relaxed shadow-sm">
                  <div className="font-bold text-indigo-600 text-xs mb-3 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Chunk #{idx + 1}
                  </div>
                  {content}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 4: NHẬT KÝ HỆ THỐNG (AUDIT LOGS)
// ─────────────────────────────────────────────────────────────
function AuditLogsTab() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminService.getAuditLogs(100).then(r => r.data.data),
    refetchInterval: 30000, 
  });

  if (isLoading) return <PageLoader />;

  const renderAction = (actionType: string) => {
    switch (actionType) {
      case 'CREATE': return <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider"><Plus className="w-3 h-3"/> Tạo mới</span>;
      case 'UPDATE': return <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider"><Edit className="w-3 h-3"/> Cập nhật</span>;
      case 'DELETE': return <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider"><Trash2 className="w-3 h-3"/> Xóa</span>;
      default:       return <span className="inline-flex items-center bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider">Khác</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ghi nhận thay đổi (Audit Trail)</h2>
          <p className="text-sm text-slate-500 mt-1">Giám sát 100 tác vụ thay đổi dữ liệu gần nhất để đảm bảo tính toàn vẹn hệ thống.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Auto-sync (30s)
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-5">Thời gian</th>
                <th className="px-6 py-5">Người thực hiện</th>
                <th className="px-6 py-5">Hành động</th>
                <th className="px-6 py-5">Bảng dữ liệu</th>
                <th className="px-6 py-5 font-mono text-center">ID</th>
                <th className="px-6 py-5 text-right">Phiên bản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(logs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20">
                    <EmptyState icon={History} title="Hệ thống chưa có lịch sử thay đổi" />
                  </td>
                </tr>
              ) : (
                logs!.map((log: AuditLogResponse, index: number) => (
                  <tr key={`${log.revision}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDateTime(log.changedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {log.changedBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800">{log.changedBy}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{renderAction(log.actionType)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{log.entityName}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400 text-sm font-semibold">
                      v{log.revision}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 5: ĐỔI MẬT KHẨU (BẢO MẬT) - THIẾT KẾ KÉT SẮT
// ─────────────────────────────────────────────────────────────
function ChangePasswordTab({ user }: { user: any }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changeMut = useMutation({
    mutationFn: () => {
      if (form.newPassword !== form.confirmPassword) throw new Error('Mật khẩu mới và xác nhận không khớp');
      if (form.newPassword.length < 8) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return authService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    },
    onSuccess: () => { toast.success('Khóa bảo mật đã được cập nhật!'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: (e: any) => { toast.error(e?.message || e?.response?.data?.message || 'Đổi mật khẩu thất bại'); },
  });

  const isValid = form.currentPassword.trim() && form.newPassword.trim() && form.confirmPassword.trim() && form.newPassword === form.confirmPassword && form.newPassword.length >= 8;
  const passwordsMatch = form.confirmPassword === '' || form.newPassword === form.confirmPassword;

  return (
    <div className="max-w-md mx-auto pt-8 animate-fade-in">
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
        {/* Nền trang trí */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Shield className="w-48 h-48" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-4 shadow-lg shadow-slate-900/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-black text-2xl text-slate-900">Bảo mật tài khoản</h3>
            <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
              <User2 className="w-4 h-4" /> <span className="font-semibold text-slate-700">{user?.username}</span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu hiện tại</label>
              <div className="relative group">
                <input type={showCurrent ? 'text' : 'password'} className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="••••••••" value={form.currentPassword} onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))} />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                  {showCurrent ? <Eye className="w-5 h-5 opacity-50" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6" />

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu mới</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Tối thiểu 8 ký tự" value={form.newPassword} onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))} />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                  {showNew ? <Eye className="w-5 h-5 opacity-50" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.newPassword && (
                <div className="mt-3 flex gap-1.5 items-center">
                  <div className="flex-1 flex gap-1 h-1.5">
                    {[...Array(4)].map((_, i) => {
                      const strength = getPasswordStrength(form.newPassword);
                      return (
                        <div key={i} className={`h-full flex-1 rounded-full transition-colors duration-300 ${i < strength ? strength === 1 ? 'bg-rose-500' : strength === 2 ? 'bg-amber-400' : strength === 3 ? 'bg-emerald-400' : 'bg-emerald-500' : 'bg-slate-100'}`} />
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold uppercase w-20 text-right text-slate-400">
                    {['', 'Rất Yếu', 'Yếu', 'Khá', 'Rất Mạnh'][getPasswordStrength(form.newPassword)]}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Xác nhận mật khẩu</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} className={`w-full pl-4 pr-12 py-3 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${form.confirmPassword && !passwordsMatch ? 'border-rose-400 focus:ring-rose-500/20 bg-rose-50/30' : 'border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`} placeholder="Nhập lại chính xác" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
              </div>
              {form.confirmPassword && !passwordsMatch && <p className="text-rose-500 text-xs font-semibold mt-2 flex items-center gap-1"><UserX className="w-3 h-3"/> Mật khẩu không khớp</p>}
              {form.confirmPassword && passwordsMatch && form.newPassword && <p className="text-emerald-600 text-xs font-semibold mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Trùng khớp hoàn toàn</p>}
            </div>
          </div>

          <button onClick={() => changeMut.mutate()} disabled={!isValid || changeMut.isPending} className="w-full mt-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-[0_4px_12px_rgb(0,0,0,0.1)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
            {changeMut.isPending ? <Spinner size="sm" className="text-white" /> : <><Shield className="w-4 h-4" /> Xác nhận đổi khóa</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}