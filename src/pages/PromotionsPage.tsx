import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom'; // <-- [FIX 3] Thêm import này
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag, Plus, Search, ChevronRight, CheckCircle2, XCircle,
  Clock, AlertTriangle, X, Percent, DollarSign, Calendar,
  Hash, ToggleLeft, ToggleRight, Edit3, Users, ShoppingCart, Globe,
  Power, PowerOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { promotionService, PromotionResponse, CreatePromotionRequest } from '@/services/promotion.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function StatusBadge({ promo }: { promo: PromotionResponse }) {
  if (!promo.isActive)  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500"><XCircle className="w-3 h-3" />Đã tắt</span>;
  if (promo.isExpired)  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600"><Clock className="w-3 h-3" />Hết hạn</span>;
  if (promo.isValid)    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Đang chạy</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Chưa bắt đầu</span>;
}

function TypeBadge({ type }: { type: string }) {
  return type === 'PERCENT'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold"><Percent className="w-3 h-3" />Phần trăm</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold"><DollarSign className="w-3 h-3" />Cố định</span>;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  ALL:    <Globe className="w-3 h-3" />,
  POS:    <ShoppingCart className="w-3 h-3" />,
  ONLINE: <Users className="w-3 h-3" />,
};
const CHANNEL_LABELS: Record<string, string> = { ALL: 'Tất cả', POS: 'POS', ONLINE: 'Online' };

// ─────────────────────────────────────────────────────────────
// CREATE / EDIT MODAL
// ─────────────────────────────────────────────────────────────
function PromotionFormModal({
  initial, onClose,
}: { initial?: PromotionResponse; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  // [FIX 1] XỬ LÝ TIMEZONE CHUẨN CHO INPUT DATETIME-LOCAL
  const toLocalDatetime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  
  const toISO = (local: string) => {
    if (!local) return '';
    return new Date(local).toISOString();
  };

  const [form, setForm] = useState({
    code:          initial?.code    ?? '',
    name:          initial?.name    ?? '',
    type:          (initial?.type   ?? 'PERCENT') as 'PERCENT' | 'FIXED_AMOUNT',
    value:         String(initial?.value         ?? ''),
    minOrderValue: String(initial?.minOrderValue ?? '0'),
    maxDiscount:   String(initial?.maxDiscount   ?? ''),
    usageLimit:    String(initial?.usageLimit    ?? ''),
    startDate:     toLocalDatetime(initial?.startDate),
    endDate:       toLocalDatetime(initial?.endDate),
    applicableTo:  (initial?.applicableTo ?? 'ALL') as 'ALL' | 'POS' | 'ONLINE',
    isActive:      initial?.isActive ?? true,
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const createMut = useMutation({
    mutationFn: (data: CreatePromotionRequest) => promotionService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); toast.success('Tạo mã thành công!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo mã'),
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => promotionService.update(initial!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); toast.success('Đã cập nhật!'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật'),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim() || !form.value || !form.startDate || !form.endDate) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc'); return;
    }
    
    // [FIX 4] Validation ở Frontend
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error('Ngày kết thúc phải sau ngày bắt đầu'); return;
    }
    if (form.type === 'PERCENT' && parseFloat(form.value) > 100) {
      toast.error('Khuyến mãi phần trăm không được vượt quá 100%'); return;
    }

    const payload: any = {
      code:          form.code.toUpperCase().trim(),
      name:          form.name,
      type:          form.type,
      value:         parseFloat(form.value),
      minOrderValue: parseFloat(form.minOrderValue) || 0,
      maxDiscount:   form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
      usageLimit:    form.usageLimit  ? parseInt(form.usageLimit)    : undefined,
      startDate:     toISO(form.startDate),
      endDate:       toISO(form.endDate),
      applicableTo:  form.applicableTo,
    };
    if (isEdit) {
      updateMut.mutate({ ...payload, isActive: form.isActive });
    } else {
      createMut.mutate(payload);
    }
  };

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );

  const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white";

  const modalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur">
          <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-xl"><Tag className="w-5 h-5 text-indigo-600" /></div>
            {isEdit ? 'Chỉnh sửa khuyến mãi' : 'Tạo mã khuyến mãi mới'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mã coupon" required>
                <input
                  className={cn(inputCls, 'uppercase font-mono tracking-wider font-bold', isEdit && 'bg-slate-50 text-slate-400 cursor-not-allowed')}
                  value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="VD: SUMMER30" maxLength={20} disabled={isEdit}
                />
                {!isEdit && <p className="text-[10px] text-slate-400 mt-1">Chỉ A-Z, 0-9, gạch ngang/dưới</p>}
              </Field>
              <Field label="Kênh áp dụng">
                <select className={cn(inputCls, 'font-semibold')} value={form.applicableTo} onChange={e => set('applicableTo', e.target.value)}>
                  <option value="ALL">Tất cả (POS + Online)</option>
                  <option value="POS">Chỉ bán tại quầy (POS)</option>
                  <option value="ONLINE">Chỉ đơn hàng Online</option>
                </select>
              </Field>
            </div>

            <Field label="Tên chương trình" required>
              <input className={cn(inputCls, 'font-medium')} value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Giảm giá mùa hè 30%" />
            </Field>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Loại giảm giá" required>
                <select className={cn(inputCls, 'font-semibold')} value={form.type} onChange={e => set('type', e.target.value as any)}>
                  <option value="PERCENT">Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
                </select>
              </Field>
              <Field label={form.type === 'PERCENT' ? 'Giá trị (%)' : 'Số tiền giảm (₫)'} required>
                <input
                  className={cn(inputCls, 'font-bold text-indigo-600')} type="number" min={0.01}
                  max={form.type === 'PERCENT' ? 100 : undefined}
                  step={form.type === 'PERCENT' ? 0.5 : 1000}
                  value={form.value} onChange={e => set('value', e.target.value)}
                  placeholder={form.type === 'PERCENT' ? '30' : '50000'}
                />
              </Field>
              {form.type === 'PERCENT' && (
                <Field label="Giảm tối đa (₫)">
                  <input className={inputCls} type="number" min={0} step={1000}
                    value={form.maxDiscount} onChange={e => set('maxDiscount', e.target.value)}
                    placeholder="Không giới hạn" />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Đơn hàng tối thiểu (₫)">
                <input className={inputCls} type="number" min={0} step={10000}
                  value={form.minOrderValue} onChange={e => set('minOrderValue', e.target.value)} placeholder="0" />
              </Field>
              <Field label="Số lần dùng tối đa">
                <input className={inputCls} type="number" min={1}
                  value={form.usageLimit} onChange={e => set('usageLimit', e.target.value)}
                  placeholder="Không giới hạn" />
              </Field>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-2 gap-4">
            <Field label="Bắt đầu" required>
              <input className={cn(inputCls, 'font-medium')} type="datetime-local" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </Field>
            <Field label="Kết thúc" required>
              <input className={cn(inputCls, 'font-medium')} type="datetime-local" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </Field>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div>
                <p className="text-sm font-bold text-slate-800">Trạng thái mã</p>
                <p className="text-xs text-slate-500 mt-0.5">Tắt mã để ngừng sử dụng mà không xóa</p>
              </div>
              <button onClick={() => set('isActive', !form.isActive)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors',
                  form.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {form.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                {form.isActive ? 'Đang bật' : 'Đã tắt'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-5 flex gap-3 justify-end border-t border-slate-100 bg-white shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy bỏ</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {isPending ? <Spinner size="sm" className="text-white" /> : <Tag className="w-4 h-4" />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo mã'}
          </button>
        </div>
      </div>
    </div>
  );

  // [FIX 3] Dùng createPortal
  return createPortal(modalContent, document.body);
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
const FILTER_OPTS = [
  { value: 'ALL',       label: 'Tất cả' },
  { value: 'ACTIVE',    label: 'Đang chạy' },
  { value: 'UPCOMING',  label: 'Sắp tới' },
  { value: 'EXPIRED',   label: 'Hết hạn' },
  { value: 'INACTIVE',  label: 'Đã tắt' },
];

export default function PromotionsPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [debouncedKw, setDebouncedKw] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PromotionResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', debouncedKw, page],
    queryFn: () => promotionService.getAll({ keyword: debouncedKw, page, size: 20 }).then(r => r.data.data),
  });

  // [FIX 2] Mutation để Bật/Tắt mã trực tiếp từ bảng
  const toggleActiveMut = useMutation({
    mutationFn: (p: PromotionResponse) => promotionService.update(p.id, { 
      name: p.name, value: p.value, minOrderValue: p.minOrderValue, 
      maxDiscount: p.maxDiscount, usageLimit: p.usageLimit, 
      startDate: p.startDate, endDate: p.endDate, 
      applicableTo: p.applicableTo as any, 
      isActive: !p.isActive 
    }),
    onSuccess: (_, vars) => { 
      qc.invalidateQueries({ queryKey: ['promotions'] }); 
      toast.success(vars.isActive ? 'Đã tắt mã khuyến mãi' : 'Đã bật lại mã khuyến mãi'); 
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi cập nhật trạng thái'),
  });

  const filtered = useMemo(() => {
    if (!data?.content) return [];
    return data.content.filter(p => {
      if (filter === 'ALL')      return true;
      if (filter === 'ACTIVE')   return p.isValid && p.isActive;
      if (filter === 'UPCOMING') return !p.isExpired && !p.isValid && p.isActive;
      if (filter === 'EXPIRED')  return p.isExpired;
      if (filter === 'INACTIVE') return !p.isActive;
      return true;
    });
  }, [data, filter]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Tag className="w-8 h-8 text-indigo-600" />Khuyến mãi
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Quản lý mã giảm giá & chương trình khuyến mãi</p>
        </div>
        {isAdmin() && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgb(0,0,0,0.1)] hover:bg-slate-800 transition-colors">
            <Plus className="w-5 h-5" />Tạo mã mới
          </button>
        )}
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Tổng mã', value: data.totalElements, color: 'text-slate-700' },
            { label: 'Đang chạy', value: data.content.filter(p => p.isValid).length, color: 'text-emerald-700' },
            { label: 'Sắp hết hạn', value: data.content.filter(p => p.isValid && new Date(p.endDate).getTime() - Date.now() < 7 * 864e5).length, color: 'text-amber-700' },
            { label: 'Đã hết hạn', value: data.content.filter(p => p.isExpired).length, color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className={cn('text-3xl font-black mt-1.5', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-11 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
            placeholder="Tìm theo mã hoặc tên..."
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setTimeout(() => setDebouncedKw(e.target.value), 300); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTER_OPTS.map(o => (
            <button key={o.value} onClick={() => setFilter(o.value)}
              className={cn('px-4 py-2.5 rounded-xl text-xs font-bold transition-all',
                filter === o.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100')}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><PageLoader /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Tag} title="Chưa có mã khuyến mãi nào" description={isAdmin() ? 'Tạo mã đầu tiên để kích hoạt khuyến mãi' : 'Không có dữ liệu phù hợp'} />
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mã / Tên</th>
                    <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loại</th>
                    <th className="text-right px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Giá trị</th>
                    <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kênh</th>
                    <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đã dùng</th>
                    <th className="text-left px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hiệu lực</th>
                    <th className="text-center px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                    {isAdmin() && <th className="px-6 py-4 w-24 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/80">
                  {filtered.map(p => (
                    <tr key={p.id} className={cn('hover:bg-slate-50/80 transition-colors group', !p.isActive && 'opacity-60 bg-slate-50/40')}>
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900 font-mono tracking-wider text-[15px]">{p.code}</p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{p.name}</p>
                      </td>
                      <td className="px-4 py-4 text-center"><TypeBadge type={p.type} /></td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-black text-indigo-600 text-[15px]">
                          {p.type === 'PERCENT' ? `${p.value}%` : formatCurrency(p.value)}
                        </span>
                        {p.maxDiscount && <p className="text-[10px] text-slate-400 font-medium mt-0.5">tối đa {formatCurrency(p.maxDiscount)}</p>}
                        {p.minOrderValue > 0 && <p className="text-[10px] text-slate-400 font-medium mt-0.5">từ {formatCurrency(p.minOrderValue)}</p>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          {CHANNEL_ICONS[p.applicableTo]}{CHANNEL_LABELS[p.applicableTo]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-slate-700 text-[14px]">{p.usedCount}</span>
                        {p.usageLimit && <span className="text-slate-400 font-medium text-xs"> / {p.usageLimit}</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                           <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {formatDate(p.startDate)}</p>
                           <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> {formatDate(p.endDate)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center"><StatusBadge promo={p} /></td>
                      {isAdmin() && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditing(p)} title="Sửa"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {/* [FIX 2] Nút Toggle Bật/Tắt */}
                            <button
                              onClick={() => { if (confirm(`Bạn muốn ${p.isActive ? 'tắt' : 'bật lại'} mã "${p.code}"?`)) toggleActiveMut.mutate(p); }}
                              title={p.isActive ? "Tắt mã" : "Bật lại mã"}
                              className={cn('p-1.5 rounded-lg transition-colors', p.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50')}>
                              {p.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && data.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <PromotionFormModal onClose={() => setShowCreate(false)} />}
      {editing && <PromotionFormModal initial={editing} onClose={() => setEditing(null)} />}
      
      {/* CSS Animation Slide */}
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