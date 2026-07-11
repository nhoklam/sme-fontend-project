/**
 * WarehousesPage — Quản lý Chi nhánh (Admin only)
 *
 * Theo Admin spec mục IV.3:
 *   "Toàn quyền CRUD: Thêm chi nhánh mới, cập nhật địa chỉ, đóng cửa (Deactivate)."
 *   "Bổ nhiệm: Gán một User (Role Manager) làm quản lý trực tiếp của chi nhánh đó."
 *
 * Backend đã sẵn sàng đầy đủ (WarehouseController: full CRUD + activate/deactivate)
 * — chỉ thiếu trang Frontend quản lý dạng list/form (trước đây warehouse.service.ts
 * chỉ được dùng làm dropdown lookup ở các trang khác).
 *
 * Route: /warehouses (Admin only)
 * Tích hợp vào App.tsx:
 *   import WarehousesPage from '@/pages/WarehousesPage';
 *   <Route path="warehouses" element={<RoleRoute roles={['ROLE_ADMIN']}><WarehousesPage /></RoleRoute>} />
 *
 * Tích hợp vào Sidebar.tsx (nhóm HỆ THỐNG):
 *   { icon: Building2, label: 'Chi nhánh', to: '/warehouses', roles: ['ROLE_ADMIN'] }
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Search, X, Edit3, Power, PowerOff,
  MapPin, Phone, UserCheck, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { warehouseService } from '@/services/warehouse.service';
import { authService } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import { PageLoader, EmptyState, Spinner } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  provinceCode?: string;
  address?: string;
  phone?: string;
  managerId?: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// CREATE / EDIT MODAL
// ─────────────────────────────────────────────────────────────
function WarehouseFormModal({ initial, onClose }: { initial?: WarehouseRow; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  // Danh sách Manager để gán
  const { data: allUsers } = useQuery({
    queryKey: ['users-for-warehouse'],
    queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data),
  });

  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    provinceCode: initial?.provinceCode ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    managerId: initial?.managerId ?? '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const createMut = useMutation({
    mutationFn: (data: any) => warehouseService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); toast.success('Tạo chi nhánh thành công!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo chi nhánh'),
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => warehouseService.update(initial!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); toast.success('Đã cập nhật!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật'),
  });
  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (!form.name.trim() || (!isEdit && !form.code.trim())) {
      toast.error('Vui lòng điền đầy đủ mã và tên chi nhánh'); return;
    }
    if (isEdit) {
      updateMut.mutate({
        name: form.name,
        provinceCode: form.provinceCode || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        managerId: form.managerId || null,
        hasManagerId: true,
      });
    } else {
      createMut.mutate({
        code: form.code.toUpperCase().trim(),
        name: form.name,
        provinceCode: form.provinceCode,
        address: form.address,
        phone: form.phone,
      });
    }
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {isEdit ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Mã chi nhánh<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input className={cn(inputCls, 'uppercase font-mono', isEdit && 'bg-slate-50 text-slate-400')}
                value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                disabled={isEdit} placeholder="VD: HCM-Q1" maxLength={20} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mã tỉnh/thành</label>
              <input className={inputCls} value={form.provinceCode} onChange={e => set('provinceCode', e.target.value)} placeholder="VD: 79 (TP.HCM)" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tên chi nhánh<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nhà sách Bookly Quận 1" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Địa chỉ</label>
            <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Nguyễn Huệ, Q.1, TP.HCM" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số điện thoại</label>
            <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="028xxxxxxx" />
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quản lý chi nhánh (Manager)</label>
              <select className={inputCls} value={form.managerId} onChange={e => set('managerId', e.target.value)}>
                <option value="">-- Chưa bổ nhiệm --</option>
                {(allUsers ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />Chỉ hiện các tài khoản có vai trò Manager
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-slate-100 pt-4 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {isPending ? <Spinner size="sm" className="text-white" /> : <Building2 className="w-4 h-4" />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo chi nhánh'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function WarehousesPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data as WarehouseRow[]),
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users-for-warehouse-list'],
    queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data),
  });
  const managerNameMap = new Map((allUsers ?? []).map((u: any) => [u.id, u.fullName]));

  const toggleMut = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      activate ? warehouseService.activate(id) : warehouseService.deactivate(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(vars.activate ? 'Đã mở lại chi nhánh' : 'Đã đóng cửa chi nhánh');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi'),
  });

  const filtered = (warehouses ?? []).filter(w =>
    !keyword || w.name.toLowerCase().includes(keyword.toLowerCase()) ||
    w.code.toLowerCase().includes(keyword.toLowerCase())
  );

  const activeCount = (warehouses ?? []).filter(w => w.isActive).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1100px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />Chi nhánh
          </h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý hệ thống chi nhánh & bổ nhiệm quản lý</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />Thêm chi nhánh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng chi nhánh</p>
          <p className="text-3xl font-black mt-1 text-slate-700">{warehouses?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang hoạt động</p>
          <p className="text-3xl font-black mt-1 text-emerald-700">{activeCount}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
          placeholder="Tìm theo mã hoặc tên chi nhánh..." value={keyword} onChange={e => setKeyword(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><PageLoader /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Không tìm thấy chi nhánh" description="Thử thay đổi từ khóa hoặc thêm chi nhánh mới" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(w => (
            <div key={w.id} className={cn(
              'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
              w.isActive ? 'border-slate-100' : 'border-slate-100 opacity-60'
            )}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-mono font-bold rounded-md">
                      <Hash className="w-2.5 h-2.5" />{w.code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1.5">{w.name}</h3>
                  </div>
                  <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0',
                    w.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')}>
                    {w.isActive ? 'Hoạt động' : 'Đã đóng'}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  {w.address && (
                    <p className="text-xs text-slate-500 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />{w.address}
                    </p>
                  )}
                  {w.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />{w.phone}
                    </p>
                  )}
                  <p className="text-xs flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    {w.managerId ? (
                      <span className="text-slate-600 font-semibold">{managerNameMap.get(w.managerId) ?? 'Đã gán'}</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Chưa bổ nhiệm Manager</span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button onClick={() => setEditing(w)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />Sửa
                  </button>
                  <button
                    onClick={() => toggleMut.mutate({ id: w.id, activate: !w.isActive })}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors',
                      w.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}>
                    {w.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    {w.isActive ? 'Đóng cửa' : 'Mở lại'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <WarehouseFormModal onClose={() => setShowCreate(false)} />}
      {editing && <WarehouseFormModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
