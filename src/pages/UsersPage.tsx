import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCog, Plus, Search, X, Edit3, Lock, Unlock,
  Building2, Mail, Phone, Shield, ShieldCheck, ShieldAlert,
  Filter, ChevronDown, Clock, User2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth.service';
import { warehouseService } from '@/services/warehouse.service';
import { cn, formatDateTime } from '@/lib/utils';
import { PageLoader, EmptyState, Spinner } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// TYPES & HELPERS
// ─────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'ROLE_ADMIN' | 'ROLE_MANAGER' | 'ROLE_CASHIER';
  warehouseId?: string;
  warehouseName?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ROLE_ADMIN:   { label: 'Quản trị viên', color: 'bg-purple-100 text-purple-700', icon: ShieldAlert },
  ROLE_MANAGER: { label: 'Quản lý chi nhánh', color: 'bg-teal-100 text-teal-700', icon: ShieldCheck },
  ROLE_CASHIER: { label: 'Thu ngân', color: 'bg-amber-100 text-amber-700', icon: Shield },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.ROLE_CASHIER;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', cfg.color)}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

const ROLE_FILTER_OPTS = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'ROLE_ADMIN', label: 'Admin' },
  { value: 'ROLE_MANAGER', label: 'Manager' },
  { value: 'ROLE_CASHIER', label: 'Cashier' },
];

// ─────────────────────────────────────────────────────────────
// CREATE / EDIT MODAL (Đã gộp logic chặt chẽ từ SettingsPage)
// ─────────────────────────────────────────────────────────────
function UserFormModal({ initial, onClose }: { initial?: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-users'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
  });

  const { data: allManagers } = useQuery({ 
    queryKey: ['users-managers'], 
    queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data) 
  });

  const [form, setForm] = useState({
    username: initial?.username ?? '',
    password: '',
    fullName: initial?.fullName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    role: initial?.role ?? 'ROLE_CASHIER',
    warehouseId: initial?.warehouseId ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // [Admin spec] Manager/Cashier BẮT BUỘC gán warehouseId. Admin thì không cần.
  const needsWarehouse = form.role !== 'ROLE_ADMIN';

  const createMut = useMutation({
    mutationFn: (data: any) => authService.createUser(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Tạo tài khoản thành công!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo tài khoản'),
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => authService.updateUser(initial!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Đã cập nhật!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật'),
  });
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (!form.username.trim() || !form.fullName.trim()) {
      toast.error('Vui lòng điền tên đăng nhập và họ tên'); return;
    }
    if (!isEdit && !form.password.trim()) {
      toast.error('Vui lòng nhập mật khẩu'); return;
    }
    if (needsWarehouse && !form.warehouseId) {
      toast.error('Manager và Thu ngân bắt buộc phải gán vào một chi nhánh'); return;
    }

    const payload: any = {
      username: form.username.trim(),
      fullName: form.fullName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      role: form.role,
      warehouseId: needsWarehouse ? form.warehouseId : null,
    };
    if (form.password.trim()) payload.password = form.password;

    if (isEdit) updateMut.mutate(payload);
    else createMut.mutate(payload);
  };

  // Tính toán danh sách kho khả dụng (Không cho 2 Manager quản lý 1 kho)
  const availableWarehouses = useMemo(() => {
    if (!warehouses) return [];
    if (form.role === 'ROLE_MANAGER') {
      const occupiedWarehouseIds = new Set((allManagers ?? []).filter((m: any) => m.warehouseId && m.id !== initial?.id).map((m: any) => m.warehouseId));
      return warehouses.filter((w: any) => !occupiedWarehouseIds.has(w.id));
    }
    return warehouses;
  }, [warehouses, form.role, allManagers, initial]);

  const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
            <User2 className="w-5 h-5 text-indigo-600" />
            {isEdit ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4 custom-scrollbar bg-slate-50/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Tên đăng nhập<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input className={cn(inputCls, isEdit && 'bg-slate-50 text-slate-400')} value={form.username}
                onChange={e => set('username', e.target.value)} disabled={isEdit} placeholder="vd: manager.q1" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {isEdit ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}{!isEdit && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input className={inputCls} type="password" value={form.password}
                onChange={e => set('password', e.target.value)} placeholder="••••••" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Họ tên<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input className={inputCls} value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Nguyễn Văn A" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@bookly.vn" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số điện thoại</label>
              <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="09xxxxxxxx" />
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 shadow-sm space-y-4 mt-2">
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Phân quyền <span className="text-rose-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {(['ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_CASHIER'] as const).map(r => {
                  const cfg = ROLE_CONFIG[r];
                  const Icon = cfg.icon;
                  return (
                    <button key={r} onClick={() => {
                        let newWid = form.warehouseId;
                        if (r === 'ROLE_ADMIN') newWid = '';
                        if (r === 'ROLE_MANAGER' && form.role === 'ROLE_CASHIER') newWid = ''; 
                        setForm(p => ({ ...p, role: r, warehouseId: newWid }));
                      }}
                      className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                        form.role === r ? 'border-indigo-400 bg-white shadow-sm' : 'border-slate-200 bg-white/50 hover:bg-white')}>
                      <Icon className={cn('w-5 h-5', form.role === r ? 'text-indigo-600' : 'text-slate-400')} />
                      <span className={cn('text-[11px] font-bold', form.role === r ? 'text-indigo-700' : 'text-slate-500')}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {needsWarehouse ? (
              <div className="relative">
                <label className="block text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2">
                  Nơi làm việc (Chi nhánh)<span className="text-rose-500 ml-0.5">*</span>
                </label>
                <select className={cn(inputCls, "appearance-none cursor-pointer")} value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)}>
                  <option value="">-- Chọn chi nhánh --</option>
                  {(availableWarehouses ?? []).filter((w: any) => w.isActive).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-[35px] w-4 h-4 text-slate-400 pointer-events-none" />
                <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1 font-medium">
                  <Building2 className="w-3 h-3" />Manager và Thu ngân bắt buộc thuộc về một chi nhánh cụ thể
                </p>
              </div>
            ) : (
              <div className="bg-white border border-purple-100 rounded-xl p-3 flex items-center gap-2 shadow-sm">
                <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />
                <p className="text-xs text-purple-700 font-medium">
                  Tài khoản Admin có quyền truy cập toàn chuỗi, không cần gán chi nhánh.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-slate-100 pt-4 shrink-0 bg-white rounded-b-3xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 transition-colors min-w-[140px] justify-center">
            {isPending ? <Spinner size="sm" className="text-white" /> : <UserCog className="w-4 h-4" />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient();
  
  // State quản lý bộ lọc
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [showLastLogin, setShowLastLogin] = useState(false);
  
  // State quản lý Modal
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  // Debounce tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Lấy danh sách chi nhánh cho bộ lọc
  const { data: warehouses } = useQuery({ 
    queryKey: ['warehouses-dict'], 
    queryFn: () => warehouseService.getAll().then(r => r.data.data) 
  });

  // Lấy danh sách Users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', debouncedKeyword, roleFilter, warehouseFilter],
    queryFn: () => authService.getUsers({
      keyword: debouncedKeyword || undefined,
      role: roleFilter || undefined,
      warehouseId: warehouseFilter || undefined
    }).then(r => r.data.data as UserRow[]),
  });

  // Mutation Khóa/Mở khóa
  const toggleActiveMut = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      activate ? authService.activateUser(id) : authService.deactivateUser(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(vars.activate ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi'),
  });

  // Tính toán thống kê KPI
  const stats = useMemo(() => {
    if (!users) return { total: 0, active: 0, admin: 0, manager: 0, cashier: 0 };
    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      admin: users.filter(u => u.role === 'ROLE_ADMIN').length,
      manager: users.filter(u => u.role === 'ROLE_MANAGER').length,
      cashier: users.filter(u => u.role === 'ROLE_CASHIER').length,
    };
  }, [users]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1400px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCog className="w-8 h-8 text-indigo-600" /> Quản lý Nhân sự
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Quản lý tài khoản, phân quyền và theo dõi hoạt động nhân viên</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgb(0,0,0,0.1)] hover:bg-slate-800 transition-colors">
          <Plus className="w-5 h-5" /> Thêm nhân sự
        </button>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Tổng nhân viên', value: stats.total, color: 'text-slate-700' },
          { label: 'Đang hoạt động', value: stats.active, color: 'text-emerald-700' },
          { label: 'Quản trị (Admin)', value: stats.admin, color: 'text-purple-700' },
          { label: 'Quản lý (Manager)', value: stats.manager, color: 'text-teal-700' },
          { label: 'Thu ngân (Cashier)', value: stats.cashier, color: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={cn('text-3xl font-black mt-1.5', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── BẢNG DỮ LIỆU & BỘ LỌC ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col relative min-h-[400px]">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="Tìm tên, username, email..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            
            <div className="relative w-full sm:w-48 shrink-0 group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
              <select 
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
              >
                {ROLE_FILTER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-56 shrink-0 group">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
              <select 
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                value={warehouseFilter} 
                onChange={e => setWarehouseFilter(e.target.value)}
              >
                <option value="">Mọi chi nhánh</option>
                {(warehouses ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <button
              onClick={() => setShowLastLogin(v => !v)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl transition-all text-sm font-bold shadow-sm shrink-0 ${
                showLastLogin 
                  ? 'bg-indigo-100 border border-indigo-200 text-indigo-700' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              {showLastLogin ? 'Ẩn đăng nhập' : 'Lịch sử đăng nhập'}
            </button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto relative flex-1">
          {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Nhân sự</th>
                <th className="px-6 py-5">Tài khoản</th>
                <th className="px-6 py-5">Liên hệ</th>
                <th className="px-6 py-5 text-center">Phân quyền</th>
                <th className="px-6 py-5">Nơi làm việc</th>
                {showLastLogin && <th className="px-6 py-5">Đăng nhập cuối</th>}
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(users ?? []).length === 0 && !isLoading ? (
                <tr><td colSpan={showLastLogin ? 8 : 7} className="py-24 text-center"><EmptyState icon={UserCog} title="Không có nhân sự nào" description="Hãy thử thay đổi bộ lọc tìm kiếm." /></td></tr>
              ) : (
                (users ?? []).map((u: UserRow) => (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors group ${!u.isActive ? 'bg-slate-50/40 grayscale-[20%]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-black text-[15px] border border-indigo-100/60 shadow-sm shrink-0">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-bold text-[14px] leading-snug ${u.isActive ? 'text-slate-900 group-hover:text-indigo-600 transition-colors' : 'text-slate-500'}`}>{u.fullName}</p>
                          {u.email && <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 shadow-sm">@{u.username}</span>
                    </td>
                    <td className="px-6 py-4">
                      {u.phone ? <div className="flex items-center gap-1.5 font-mono font-bold text-[13px] text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" /> {u.phone}</div> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 text-[13px]">
                      {u.warehouseName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />{u.warehouseName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Toàn hệ thống</span>
                      )}
                    </td>
                    {showLastLogin && (
                      <td className="px-6 py-4 text-slate-500 text-xs font-semibold">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="italic font-medium text-slate-400">Chưa đăng nhập</span>}
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[5rem] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
                        u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(u); setShowCreate(true); }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Chỉnh sửa">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if(window.confirm(`Bạn có chắc muốn ${u.isActive ? 'khóa' : 'kích hoạt'} tài khoản này?`)) toggleActiveMut.mutate({ id: u.id, activate: !u.isActive }); }}
                          className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={u.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
                        >
                          {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
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
      {showCreate && <UserFormModal onClose={() => { setShowCreate(false); setEditing(null); }} initial={editing || undefined} />}
      
      {/* CSS Animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}