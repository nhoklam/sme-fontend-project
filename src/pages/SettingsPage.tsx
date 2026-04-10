import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Warehouse, Bot, UserCheck, UserX, Plus, Upload, FileText,
  Trash2, Eye, Edit, Search, Filter, Lock, Phone, Clock,
  Shield, User2, History, // Đã bổ sung History icon
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { warehouseService } from '@/services/warehouse.service';
import { aiService, KnowledgeDocument } from '@/services/ai.service';
import { adminService } from '@/services/admin.service'; // Đã bổ sung adminService
import { useAuthStore } from '@/stores/auth.store';
import { formatDateTime, getRoleLabel, getRoleColor } from '@/lib/utils';
import { PageLoader, Spinner, ConfirmDialog, EmptyState } from '@/components/ui'; // Đã bổ sung EmptyState
import toast from 'react-hot-toast';
import type { AuditLogResponse } from '@/types'; // Đã bổ sung Type

// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE ROOT
// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isAdmin } = useAuthStore();
  
  // Nếu là Admin thì mặc định mở tab Users, còn Manager/Cashier thì mở tab Password
  const defaultTab = isAdmin() ? 'users' : 'password';
  const [tab, setTab] = useState<'users' | 'warehouses' | 'ai' | 'audit' | 'password'>(defaultTab as any);

  // Chỉ có Admin mới được xem Users, Warehouses, AI và Audit Logs
  const tabs = [
    { id: 'users',      label: '👤 Người dùng',   show: isAdmin() }, 
    { id: 'warehouses', label: '🏢 Chi nhánh',    show: isAdmin() }, 
    { id: 'ai',         label: '🤖 Tài liệu AI',  show: isAdmin() }, 
    { id: 'audit',      label: '📜 Nhật ký hệ thống', show: isAdmin() }, // ĐÃ THÊM TAB NÀY
    { id: 'password',   label: '🔑 Đổi mật khẩu', show: true },      
  ].filter(t => t.show);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'      && <UsersTab />}
      {tab === 'warehouses' && <WarehousesTab />}
      {tab === 'ai'         && <AIDocumentsTab />}
      {tab === 'audit'      && <AuditLogsTab />} {/* ĐÃ THÊM COMPONENT NÀY */}
      {tab === 'password'   && <ChangePasswordTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1: USERS
// ─────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ keyword: '', role: '', warehouseId: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    username: '', password: '', fullName: '',
    email: '', phone: '',
    role: 'ROLE_CASHIER', warehouseId: '',
  });
  const [showLastLogin, setShowLastLogin] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      return authService.getUsers(cleanFilters).then(r => r.data.data);
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const { data: allManagers } = useQuery({
    queryKey: ['users-managers'],
    queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? authService.activateUser(id) : authService.deactivateUser(id),
    onSuccess: () => { toast.success('Đã cập nhật trạng thái'); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = { ...form };
      if (!payload.warehouseId) payload.warehouseId = null;
      if (editing && !payload.password) delete payload.password;
      return editing
        ? authService.updateUser(editing.id, payload)
        : authService.createUser(payload);
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
      setForm({
        username:    user.username,
        password:    '',
        fullName:    user.fullName,
        email:       user.email ?? '',
        phone:       user.phone ?? '',
        role:        user.role,
        warehouseId: user.warehouseId ?? '',
      });
    } else {
      setEditing(null);
      setForm({ username: '', password: '', fullName: '', email: '', phone: '', role: 'ROLE_CASHIER', warehouseId: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ username: '', password: '', fullName: '', email: '', phone: '', role: 'ROLE_CASHIER', warehouseId: '' });
  };

  const availableWarehouses = useMemo(() => {
    if (!warehouses) return [];
    
    if (form.role === 'ROLE_MANAGER') {
      const occupiedWarehouseIds = new Set(
        (allManagers ?? [])
          .filter((m: any) => m.warehouseId && m.id !== editing?.id)
          .map((m: any) => m.warehouseId)
      );

      return warehouses.filter((w: any) => !occupiedWarehouseIds.has(w.id));
    }
    
    return warehouses;
  }, [warehouses, form.role, allManagers, editing]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 bg-white"
              placeholder="Tìm tên, username, email..."
              value={filters.keyword}
              onChange={e => setFilters(p => ({ ...p, keyword: e.target.value }))}
            />
          </div>
          <div className="w-36 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select className="input pl-9 bg-white" value={filters.role} onChange={e => setFilters(p => ({ ...p, role: e.target.value }))}>
              <option value="">Mọi vai trò</option>
              <option value="ROLE_ADMIN">Admin</option>
              <option value="ROLE_MANAGER">Quản lý</option>
              <option value="ROLE_CASHIER">Thu ngân</option>
            </select>
          </div>
          <div className="w-48 relative">
            <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select className="input pl-9 bg-white" value={filters.warehouseId} onChange={e => setFilters(p => ({ ...p, warehouseId: e.target.value }))}>
              <option value="">Mọi chi nhánh</option>
              {(warehouses ?? []).map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowLastLogin(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showLastLogin ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {showLastLogin ? 'Ẩn đăng nhập' : 'Hiện đăng nhập'}
          </button>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> Thêm nhân viên
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Tên đăng nhập</th>
                <th>SĐT</th>
                <th>Vai trò</th>
                <th>Chi nhánh</th>
                {showLastLogin && <th>Đăng nhập lần cuối</th>}
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).length === 0 ? (
                <tr><td colSpan={showLastLogin ? 8 : 7} className="text-center py-6 text-gray-500">Không tìm thấy người dùng nào phù hợp.</td></tr>
              ) : (
                (users ?? []).map((u: any) => (
                  <tr key={u.id} className={!u.isActive ? 'bg-gray-50 opacity-80' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.fullName}</p>
                          {u.email && <p className="text-xs text-gray-500">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-gray-600">{u.username}</td>
                    <td className="text-gray-600 text-sm">{u.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td><span className={`badge text-xs ${getRoleColor(u.role)}`}>{getRoleLabel(u.role)}</span></td>
                    <td className="text-gray-600 text-sm font-medium">{u.warehouseName ?? '---'}</td>
                    {showLastLogin && (
                      <td className="text-gray-500 text-xs">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-gray-300">Chưa đăng nhập</span>}
                      </td>
                    )}
                    <td>
                      <span className={`badge text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenModal(u)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Sửa thông tin">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleMut.mutate({ id: u.id, active: !u.isActive })}
                          className={`btn-ghost btn-sm p-1.5 ${u.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-4">{editing ? 'Sửa thông tin nhân viên' : 'Tạo tài khoản nhân viên'}</h3>

            <div className="space-y-3">
              <div>
                <label className="label">Tên đăng nhập *</label>
                <input className="input" placeholder="VD: cashier01" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} disabled={!!editing} />
              </div>
              <div>
                <label className="label">Mật khẩu {!editing && '*'}</label>
                <input type="password" className="input" placeholder={editing ? 'Bỏ trống nếu không muốn đổi pass' : 'Tối thiểu 8 ký tự'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">Họ và tên *</label>
                <input className="input" placeholder="VD: Nguyễn Văn A" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email liên hệ</label>
                  <input type="email" className="input" placeholder="VD: nva@congty.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><Phone className="w-3 h-3" /> Số điện thoại</label>
                  <input type="tel" className="input" placeholder="VD: 0912345678" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vai trò *</label>
                  <select 
                    className="input" 
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
                    <option value="ROLE_ADMIN">Admin</option>
                    <option value="ROLE_MANAGER">Quản lý</option>
                    <option value="ROLE_CASHIER">Thu ngân</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nơi làm việc</label>
                  
                  <select 
                    className="input" 
                    value={form.warehouseId} 
                    onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))} 
                    disabled={form.role === 'ROLE_ADMIN'}
                  >
                    <option value="">-- {form.role === 'ROLE_ADMIN' ? 'Trống (Admin)' : 'Chọn chi nhánh'} --</option>
                    {availableWarehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>

                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleCloseModal} className="btn-secondary flex-1">Hủy</button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.username || (!editing && !form.password) || !form.fullName}
                className="btn-primary flex-1"
              >
                {saveMut.isPending ? <Spinner size="sm" /> : (editing ? 'Lưu thay đổi' : 'Tạo tài khoản')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: WAREHOUSES
// ─────────────────────────────────────────────────────────────
function WarehousesTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: '', name: '', provinceCode: '', address: '', phone: '',
    managerId: '',
  });

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const { data: managers } = useQuery({
    queryKey: ['users-managers'],
    queryFn: () => authService.getUsers({ role: 'ROLE_MANAGER' }).then(r => r.data.data),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = { ...form };
      if (!payload.managerId) payload.managerId = null;
      return editing
        ? warehouseService.update(editing.id, payload)
        : warehouseService.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Cập nhật chi nhánh thành công!' : 'Thêm chi nhánh thành công!');
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      handleCloseModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi lưu chi nhánh'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => warehouseService.deactivate(id),
    onSuccess: () => { toast.success('Đã ngừng hoạt động chi nhánh'); qc.invalidateQueries({ queryKey: ['warehouses'] }); },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => warehouseService.activate(id),
    onSuccess: () => { toast.success('Đã khôi phục hoạt động chi nhánh'); qc.invalidateQueries({ queryKey: ['warehouses'] }); },
  });

  const handleOpenModal = (warehouse?: any) => {
    if (warehouse) {
      setEditing(warehouse);
      setForm({
        code:        warehouse.code,
        name:        warehouse.name,
        provinceCode: warehouse.provinceCode,
        address:     warehouse.address ?? '',
        phone:       warehouse.phone ?? '',
        managerId:   warehouse.managerId ?? '',
      });
    } else {
      setEditing(null);
      setForm({ code: '', name: '', provinceCode: '', address: '', phone: '', managerId: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ code: '', name: '', provinceCode: '', address: '', phone: '', managerId: '' });
  };

  const managerMap = new Map<string, string>();
  (managers ?? []).forEach((m: any) => managerMap.set(m.id, m.fullName));

  const availableManagers = useMemo(() => {
    if (!managers || !warehouses) return [];
    
    const usedManagerIds = new Set(
      warehouses
        .filter((w: any) => w.managerId && w.id !== editing?.id)
        .map((w: any) => w.managerId)
    );

    return managers.filter((m: any) => !usedManagerIds.has(m.id));
  }, [managers, warehouses, editing]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-4 h-4" /> Thêm chi nhánh
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên chi nhánh</th>
                <th>Tỉnh/TP</th>
                <th>Địa chỉ</th>
                <th>SĐT</th>
                <th>Quản lý</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {(warehouses ?? []).map((w: any) => (
                <tr key={w.id} className={!w.isActive ? 'bg-gray-50 opacity-75' : ''}>
                  <td className="font-mono font-bold text-primary-600">{w.code}</td>
                  <td className="font-medium">{w.name}</td>
                  <td className="text-gray-500">{w.provinceCode}</td>
                  <td className="text-gray-500 text-sm max-w-[200px] truncate">{w.address ?? '-'}</td>
                  <td>{w.phone ?? '-'}</td>
                  <td className="text-gray-600 text-sm">
                    {w.managerId
                      ? (managerMap.get(w.managerId) ?? <span className="text-gray-400 text-xs font-mono">{w.managerId.slice(0,8)}...</span>)
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {w.isActive ? 'Hoạt động' : 'Đã đóng cửa'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenModal(w)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Sửa thông tin">
                        <Edit className="w-4 h-4" />
                      </button>
                      {w.isActive ? (
                        <button onClick={() => { if (window.confirm('Ngừng hoạt động chi nhánh này?')) deactivateMut.mutate(w.id); }}
                          className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Ngừng hoạt động" disabled={deactivateMut.isPending}>
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => { if (window.confirm('Khôi phục hoạt động chi nhánh này?')) activateMut.mutate(w.id); }}
                          className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Khôi phục hoạt động" disabled={activateMut.isPending}>
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-4">{editing ? 'Sửa thông tin chi nhánh' : 'Thêm chi nhánh mới'}</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Mã chi nhánh *</label>
                <input className="input" placeholder="VD: HCM03" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} disabled={!!editing} autoFocus={!editing} />
              </div>
              <div>
                <label className="label">Tên chi nhánh *</label>
                <input className="input" placeholder="VD: Cửa hàng Quận 3" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus={!!editing} />
              </div>
              <div>
                <label className="label">Mã Tỉnh/Thành phố *</label>
                <input className="input" placeholder="VD: 79 (Mã TP.HCM)" value={form.provinceCode} onChange={e => setForm(p => ({ ...p, provinceCode: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Số điện thoại</label>
                  <input className="input" placeholder="0901..." value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><User2 className="w-3 h-3" /> Quản lý chi nhánh</label>
                  
                  <select className="input" value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}>
                    <option value="">-- Chưa gán --</option>
                    {availableManagers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>

                </div>
              </div>
              <div>
                <label className="label">Địa chỉ</label>
                <textarea className="input resize-none" rows={2} placeholder="Số nhà, đường, phường/xã..." value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCloseModal} className="btn-secondary flex-1">Hủy</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.code || !form.name || !form.provinceCode} className="btn-primary flex-1">
                {saveMut.isPending ? <Spinner size="sm" /> : (editing ? 'Lưu thay đổi' : 'Tạo chi nhánh')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3: AI DOCUMENTS
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

  const { data: documents, isLoading } = useQuery({
    queryKey: ['ai-documents'],
    queryFn: () => aiService.getDocuments().then(r => r.data.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiService.deleteDocument(id),
    onSuccess: () => {
      toast.success('Đã xóa tài liệu và làm sạch dữ liệu AI');
      qc.invalidateQueries({ queryKey: ['ai-documents'] });
      setDocToDelete(null);
    },
    onError: () => toast.error('Lỗi khi xóa tài liệu'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await aiService.uploadDocument(file, file.name);
      toast.success(`Đã học xong "${file.name}" — ${res.data.data.chunks} đoạn kiến thức`);
      qc.invalidateQueries({ queryKey: ['ai-documents'] });
    } catch {
      toast.error('Lỗi upload tài liệu');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await aiService.searchSemantic(searchQuery, topK);
      setSearchResults(res.data.data);
      if (res.data.data.length === 0) toast('Không tìm thấy kết quả phù hợp', { icon: '🔍' });
    } catch {
      toast.error('Lỗi khi tìm kiếm ngữ nghĩa');
    } finally {
      setSearching(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="card p-6 border-dashed border-2 border-primary-200 flex flex-col items-center justify-center gap-3 text-center bg-blue-50/30">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Dạy kiến thức mới cho AI</p>
          <p className="text-gray-500 text-sm mt-1">Upload Chính sách, Quy trình, Hướng dẫn sử dụng (PDF, DOCX, TXT)</p>
        </div>
        <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-60' : ''}`}>
          {uploading ? <><Spinner size="sm" />Đang xử lý và Vector hóa...</> : <><Upload className="w-4 h-4" />Tải lên tài liệu</>}
          <input type="file" accept=".pdf,.docx,.doc,.txt,.pptx" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-primary-500" /> Tìm kiếm ngữ nghĩa (RAG Search)
          </h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">AI Semantic</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">Kiểm tra chất lượng tài liệu đã upload bằng cách tìm kiếm ngữ nghĩa thực tế.</p>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="VD: Chính sách đổi trả hàng, Quy trình nhập kho..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSemanticSearch()}
              />
            </div>
            <select className="input w-28" value={topK} onChange={e => setTopK(Number(e.target.value))} title="Số kết quả trả về">
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
            <button onClick={handleSemanticSearch} disabled={searching || !searchQuery.trim()} className="btn-primary px-5">
              {searching ? <Spinner size="sm" /> : 'Tìm kiếm'}
            </button>
          </div>

          {searchResults !== null && (
            <div className="space-y-3 mt-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl">
                  Không tìm thấy đoạn tri thức phù hợp với từ khóa này.
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 font-medium">Tìm thấy {searchResults.length} đoạn tri thức phù hợp:</p>
                  {searchResults.map((result: any, idx: number) => (
                    <div key={idx} className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl text-sm text-gray-700 leading-relaxed">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Kết quả #{idx + 1}</span>
                        {result.score !== undefined && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Điểm: {(result.score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p>{result.content ?? result.text ?? JSON.stringify(result)}</p>
                      {result.source && (
                        <p className="text-xs text-gray-400 mt-2">Nguồn: {result.source}</p>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setSearchResults(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Xóa kết quả tìm kiếm
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-800">Cơ sở tri thức hiện tại của AI</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Tên tài liệu</th><th>Định dạng</th><th>Số đoạn tri thức</th><th>Ngày tải lên</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {(documents ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Chưa có tài liệu nào trong hệ thống</td></tr>
              ) : (
                (documents ?? []).map((doc: KnowledgeDocument) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-gray-700">{doc.title}</span>
                      </div>
                    </td>
                    <td><span className="badge bg-gray-100 text-gray-600 font-mono uppercase">{doc.fileType}</span></td>
                    <td>
                      <span className="font-semibold text-primary-600">{doc.chunkCount}</span>{' '}
                      <span className="text-xs text-gray-400">đoạn</span>
                    </td>
                    <td className="text-gray-500 text-sm">{formatDateTime(doc.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDocToView(doc)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Xem nội dung chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDocToDelete(doc.id)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Xóa tài liệu">
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

      {docToView && <DocumentDetailsModal doc={docToView} onClose={() => setDocToView(null)} />}

      <ConfirmDialog
        open={!!docToDelete}
        title="Xóa tri thức AI"
        description="Xóa tài liệu này sẽ xóa luôn mọi hiểu biết của AI về nó (Xóa dữ liệu Vector). Bạn có chắc chắn không?"
        danger={true}
        onConfirm={() => deleteMut.mutate(docToDelete!)}
        onCancel={() => setDocToDelete(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function DocumentDetailsModal({ doc, onClose }: { doc: KnowledgeDocument; onClose: () => void }) {
  const { data: chunks, isLoading } = useQuery({
    queryKey: ['ai-document-chunks', doc.id],
    queryFn: () => aiService.getDocumentChunks(doc.id).then(r => r.data.data),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4 border-b pb-4">
          <div>
            <h3 className="font-bold text-xl text-gray-800">{doc.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Định dạng: <span className="uppercase font-mono">{doc.fileType}</span> • Ngày tải lên: {formatDateTime(doc.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="sticky top-0 bg-white pb-2 flex justify-between items-center z-10">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary-500" /> Nội dung AI đã học ({doc.chunkCount} đoạn)
            </h4>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : chunks?.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10 bg-gray-50 rounded-xl">Không tìm thấy nội dung hoặc AI chưa xử lý xong.</p>
          ) : (
            <div className="space-y-3">
              {chunks?.map((content, idx) => (
                <div key={idx} className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl text-sm text-gray-700 leading-relaxed shadow-sm">
                  <div className="font-semibold text-blue-600 text-xs mb-2 uppercase tracking-wider">Đoạn #{idx + 1}</div>
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
    refetchInterval: 30000, // Tự động làm mới mỗi 30 giây
  });

  if (isLoading) return <PageLoader />;

  // Hàm helper để render màu sắc và icon theo hành động
  const renderAction = (actionType: string) => {
    switch (actionType) {
      case 'CREATE':
        return <span className="badge bg-green-100 text-green-700 border-green-200"><Plus className="w-3 h-3 mr-1 inline"/> Thêm mới</span>;
      case 'UPDATE':
        return <span className="badge bg-blue-100 text-blue-700 border-blue-200"><Edit className="w-3 h-3 mr-1 inline"/> Cập nhật</span>;
      case 'DELETE':
        return <span className="badge bg-red-100 text-red-700 border-red-200"><Trash2 className="w-3 h-3 mr-1 inline"/> Xóa</span>;
      default:
        return <span className="badge bg-gray-100 text-gray-700">Khác</span>;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Nhật ký thao tác (Audit Logs)</h2>
          <p className="text-sm text-gray-500 mt-1">Theo dõi 100 thay đổi dữ liệu gần nhất trên toàn hệ thống.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Phân hệ (Bảng)</th>
                <th>ID Bản ghi</th>
                <th className="text-center">Phiên bản (Rev)</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={History} title="Chưa có lịch sử thao tác nào" />
                  </td>
                </tr>
              ) : (
                logs!.map((log: AuditLogResponse, index: number) => (
                  <tr key={`${log.revision}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="text-sm text-gray-600 font-medium">
                      {formatDateTime(log.changedAt)}
                    </td>
                    <td>
                      <span className="font-semibold text-gray-800">{log.changedBy}</span>
                    </td>
                    <td>{renderAction(log.actionType)}</td>
                    <td className="font-medium text-gray-700">{log.entityName}</td>
                    <td>
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="text-center font-mono text-gray-400 text-sm">
                      #{log.revision}
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
// TAB 5: ĐỔI MẬT KHẨU
// ─────────────────────────────────────────────────────────────
function ChangePasswordTab() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changeMut = useMutation({
    mutationFn: () => {
      if (form.newPassword !== form.confirmPassword) {
        throw new Error('Mật khẩu mới và xác nhận không khớp');
      }
      if (form.newPassword.length < 8) {
        throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
      }
      return authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
    },
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: any) => {
      const msg = e?.message || e?.response?.data?.message || 'Đổi mật khẩu thất bại';
      toast.error(msg);
    },
  });

  const isValid =
    form.currentPassword.trim() &&
    form.newPassword.trim() &&
    form.confirmPassword.trim() &&
    form.newPassword === form.confirmPassword &&
    form.newPassword.length >= 8;

  const passwordsMatch = form.confirmPassword === '' || form.newPassword === form.confirmPassword;

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-7 h-7 text-primary-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-800">Đổi mật khẩu</h3>
            <p className="text-sm text-gray-500">Tài khoản: <span className="font-medium text-gray-700">{user?.fullName}</span> ({user?.username})</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-gray-500" /> Mật khẩu hiện tại *
            </label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} className="input pr-10" placeholder="Nhập mật khẩu hiện tại..." value={form.currentPassword} onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))} autoFocus />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showCurrent ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="border-t pt-2" />

          <div>
            <label className="label">Mật khẩu mới * <span className="text-gray-400 font-normal">(tối thiểu 8 ký tự)</span></label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} className="input pr-10" placeholder="Nhập mật khẩu mới..." value={form.newPassword} onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))} />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showNew ? '🙈' : '👁️'}</button>
            </div>
            {form.newPassword && (
              <div className="mt-2 flex gap-1">
                {[...Array(4)].map((_, i) => {
                  const strength = getPasswordStrength(form.newPassword);
                  return (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-amber-400' : strength === 3 ? 'bg-yellow-400' : 'bg-green-500' : 'bg-gray-200'}`} />
                  );
                })}
                <span className="text-xs text-gray-500 ml-2">{['', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][getPasswordStrength(form.newPassword)]}</span>
              </div>
            )}
          </div>

          <div>
            <label className="label">Xác nhận mật khẩu mới *</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} className={`input pr-10 ${form.confirmPassword && !passwordsMatch ? 'border-red-400 focus:ring-red-500' : ''}`} placeholder="Nhập lại mật khẩu mới..." value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirm ? '🙈' : '👁️'}</button>
            </div>
            {form.confirmPassword && !passwordsMatch && <p className="text-red-500 text-xs mt-1">Mật khẩu xác nhận không khớp</p>}
            {form.confirmPassword && passwordsMatch && form.newPassword && <p className="text-green-600 text-xs mt-1">✓ Mật khẩu khớp</p>}
          </div>
        </div>

        <button onClick={() => changeMut.mutate()} disabled={!isValid || changeMut.isPending} className="btn-primary w-full py-2.5">
          {changeMut.isPending ? <Spinner size="sm" /> : '🔑 Xác nhận đổi mật khẩu'}
        </button>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 space-y-1">
          <p className="font-semibold">Lưu ý bảo mật:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-600">
            <li>Mật khẩu tối thiểu 8 ký tự</li>
            <li>Nên kết hợp chữ hoa, thường, số và ký tự đặc biệt</li>
            <li>Không chia sẻ mật khẩu với người khác</li>
          </ul>
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