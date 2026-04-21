import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Calendar, Search, Plus, X, CheckCircle, Download, Printer, History, Landmark, Banknote, Wallet, FileText, CreditCard, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { financeService } from '@/services/finance.service';
import { warehouseService } from '@/services/warehouse.service';
import { supplierService } from '@/services/supplier.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Spinner, Pagination, EmptyState } from '@/components/ui';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TimeRange = 'today' | 'week' | 'month' | 'year' | '30days';

// --- CẤU HÌNH TOOLTIP CHO BIỂU ĐỒ BAR CHART ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100/80 min-w-[180px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 border-b border-slate-100/80 pb-2">{label}</p>
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-medium text-slate-500">{entry.name}:</span>
              </div>
              <span className={`text-sm font-black tracking-tight ${entry.name.includes('Thu') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────
// COMPONENT 1: MODAL TẠO PHIẾU THU/CHI
// ─────────────────────────────────────────────────────────────────
function CashbookEntryModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const { warehouseId, isAdmin } = useAuthStore();
  
  const [form, setForm] = useState({
    warehouseId: isAdmin() ? '' : (warehouseId() ?? ''),
    fundType: 'CASH_111',
    transactionType: 'IN',
    amount: '',
    description: '',
    referenceType: 'MANUAL', 
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: isAdmin(),
  });

  const mut = useMutation({
    mutationFn: () => financeService.createCashbookEntry({
      warehouseId: form.warehouseId,
      fundType: form.fundType,
      transactionType: form.transactionType,
      amount: Number(form.amount),
      description: form.description,
      referenceType: form.referenceType, 
    }),
    onSuccess: () => {
      toast.success('Tạo phiếu thành công');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi tạo phiếu'),
  });

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl animate-scale-in overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">Tạo Phiếu Thu / Chi</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Ghi nhận giao dịch tài chính thủ công vào hệ thống</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          {isAdmin() && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chi nhánh <span className="text-rose-500">*</span></label>
              <div className="relative">
                <select className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3.5 transition-colors outline-none font-bold cursor-pointer appearance-none shadow-sm" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                  <option value="">-- Chọn chi nhánh --</option>
                  {(warehouses ?? []).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loại phiếu</label>
              <div className="relative">
                <select className={`w-full text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3.5 transition-colors outline-none cursor-pointer appearance-none shadow-sm ${form.transactionType === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`} value={form.transactionType} onChange={e => setForm({ ...form, transactionType: e.target.value })}>
                  <option value="IN">Phiếu Thu (+)</option>
                  <option value="OUT">Phiếu Chi (-)</option>
                </select>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${form.transactionType === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loại quỹ</label>
              <div className="relative">
                <select className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3.5 transition-colors outline-none font-bold cursor-pointer appearance-none shadow-sm" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
                  <option value="CASH_111">Tiền mặt (TK 111)</option>
                  <option value="BANK_112">Ngân hàng (TK 112)</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loại chứng từ</label>
              <div className="relative">
                <select className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3.5 transition-colors outline-none font-bold cursor-pointer appearance-none shadow-sm" value={form.referenceType} onChange={e => setForm({ ...form, referenceType: e.target.value })}>
                  <option value="MANUAL">Thủ công</option>
                  <option value="EXPENSE">Chi phí vận hành</option>
                  <option value="OTHER_INCOME">Thu nhập khác</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số tiền (VNĐ) <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              className={`w-full bg-white border text-3xl font-black tracking-tight rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-5 transition-all outline-none shadow-inner ${form.transactionType === 'IN' ? 'text-emerald-600 border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500/20' : 'text-rose-600 border-rose-100 focus:border-rose-500 focus:ring-rose-500/20'}`} 
              placeholder="Nhập số tiền..." 
              value={form.amount} 
              onChange={e => setForm({ ...form, amount: e.target.value })} 
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lý do / Mô tả chi tiết <span className="text-rose-500">*</span></label>
            <textarea className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none font-medium resize-none shadow-sm custom-scrollbar" rows={3} placeholder="Ví dụ: Nộp tiền điện nước tháng 10, Tiền rác, v.v..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy bỏ</button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.amount || !form.warehouseId || !form.description.trim()} 
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[0_4px_12px_rgb(99,102,241,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center min-w-[140px]"
          >
            {mut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận tạo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 2: MODAL THANH TOÁN CÔNG NỢ
// ─────────────────────────────────────────────────────────────────
function PayDebtModal({ debt, onClose, onSaved }: { debt: any, onClose: () => void, onSaved: () => void }) {
  const [form, setForm] = useState({
    amount: debt.remainingAmount.toString(),
    fundType: 'CASH_111',
    note: `Thanh toán công nợ PO: ${debt.purchaseOrderCode || debt.purchaseOrderId || ''}`,
  });

  const mut = useMutation({
    mutationFn: () => financeService.paySupplierDebt({
      supplierDebtId: debt.id,
      amount: Number(form.amount),
      fundType: form.fundType,
      note: form.note,
    }),
    onSuccess: () => {
      toast.success('Thanh toán công nợ thành công');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi thanh toán công nợ'),
  });

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden border border-slate-100 flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-900 tracking-tight">Thanh toán nợ</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">PO: <span className="font-mono font-bold text-indigo-600 uppercase">{debt.purchaseOrderCode || debt.purchaseOrderId?.slice(0,8)}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6 bg-slate-50/30">
          <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Dư nợ cần thanh toán</span>
            <span className="font-black tracking-tight text-rose-600 text-3xl">{formatCurrency(debt.remainingAmount)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số tiền trả (VNĐ) <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              className="w-full bg-white border border-slate-200 text-slate-900 text-2xl font-black tracking-tight rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none shadow-inner" 
              max={debt.remainingAmount} 
              value={form.amount} 
              onChange={e => setForm({ ...form, amount: e.target.value })} 
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Thanh toán từ quỹ <span className="text-rose-500">*</span></label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3.5 transition-colors outline-none cursor-pointer appearance-none shadow-sm" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
                <option value="CASH_111">Tiền mặt (TK 111)</option>
                <option value="BANK_112">Ngân hàng (TK 112)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ghi chú thanh toán</label>
            <textarea className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none font-medium resize-none shadow-sm" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy bỏ</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.amount || Number(form.amount) <= 0 || Number(form.amount) > debt.remainingAmount} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[0_4px_12px_rgb(99,102,241,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center min-w-[150px]">
            {mut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 3: MODAL LỊCH SỬ THANH TOÁN CÔNG NỢ
// ─────────────────────────────────────────────────────────────────
function DebtHistoryModal({ debt, onClose }: { debt: any, onClose: () => void }) {
  const { warehouseId, isAdmin } = useAuthStore();
  const wid = isAdmin() ? '' : (debt.warehouseId || warehouseId() || '');

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['debt-history', debt.purchaseOrderId, wid],
    queryFn: () => financeService.searchCashbook({
      warehouseId: wid,
      from: new Date('2020-01-01').toISOString(),
      to: new Date().toISOString(),
      fundType: 'ALL',
      transactionType: 'OUT',
      keyword: debt.purchaseOrderCode || debt.purchaseOrderId || '', 
      page: 0,
      size: 100
    }).then(r => r.data.data)
  });

  const payments = historyData?.content?.filter((t: any) => t.referenceType === 'SUPPLIER_PAYMENT') || [];

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl animate-scale-in flex flex-col max-h-[85vh] border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hidden sm:flex items-center justify-center shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">Lịch sử thanh toán nợ</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">PO: <span className="font-mono font-bold text-indigo-600 uppercase">{debt.purchaseOrderCode || debt.purchaseOrderId?.slice(0,8)}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-[0_4px_24px_rgb(0,0,0,0.02)]">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="bg-slate-50/50 uppercase text-[11px] font-bold border-b border-slate-100 tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-5">Ngày trả</th>
                  <th className="px-6 py-5">Loại quỹ</th>
                  <th className="px-6 py-5 text-right">Số tiền</th>
                  <th className="px-6 py-5">Ghi chú / Mô tả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80">
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-20"><Spinner size="md" className="mx-auto text-indigo-600"/></td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-20 text-slate-500 font-medium bg-slate-50/30">Chưa có lịch sử thanh toán nào cho đơn này.</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-slate-600 font-medium text-[13px]">{formatDateTime(p.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${p.fundType === 'CASH_111' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-blue-50 text-blue-700 border-blue-200/60'}`}>
                          {p.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-base tracking-tight text-emerald-600 text-right">{formatCurrency(p.amount)}</td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 max-w-[300px] truncate" title={p.description}>{p.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm">Đóng cửa sổ</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
// PAGE CHÍNH
// ─────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const { warehouseId, isAdmin } = useAuthStore();
  const wid = warehouseId() ?? '';
  const qc = useQueryClient(); 
  const PAGE_SIZE = 15;

  const [tab, setTab] = useState<'cashbook' | 'debts'>('cashbook');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [debtToPay, setDebtToPay] = useState<any | null>(null);
  const [debtHistory, setDebtHistory] = useState<any | null>(null); 

  // --- STATES SỔ QUỸ ---
  const [keywordTxn, setKeywordTxn] = useState('');
  const [debouncedKeywordTxn, setDebouncedKeywordTxn] = useState(''); 
  const [filterFund, setFilterFund] = useState<string>('ALL'); 
  const [filterType, setFilterType] = useState<string>('ALL'); 
  const [filterRef, setFilterRef] = useState<string>('ALL'); 
  const [pageTxn, setPageTxn] = useState(0);

  // --- STATES CÔNG NỢ ---
  const [keywordDebt, setKeywordDebt] = useState('');
  const [pageDebt, setPageDebt] = useState(0);

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeywordTxn(keywordTxn), 500);
    return () => clearTimeout(timer);
  }, [keywordTxn]);

  // Reset trang khi đổi filter
  useEffect(() => { setPageTxn(0); }, [debouncedKeywordTxn, filterFund, filterType, filterRef, timeRange]);
  useEffect(() => { setPageDebt(0); }, [keywordDebt]);

  const { from, to } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (timeRange) {
      case 'today': start = startOfDay(now); end = endOfDay(now); break;
      case 'week': start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
      case 'month': start = startOfMonth(now); end = endOfMonth(now); break;
      case 'year': start = startOfYear(now); end = endOfYear(now); break;
      case '30days': default: start = subDays(now, 30); end = now; break;
    }
    return { from: start.toISOString(), to: end.toISOString() };
  }, [timeRange]);

  // --- GỌI API TỔNG QUAN ---
  const { data: balance } = useQuery({
    queryKey: ['cashbook-balance', wid],
    queryFn: () => financeService.getCashbookBalance(wid).then(r => r.data.data),
    enabled: isAdmin() || !!wid, 
    refetchInterval: 60_000,
  });

  // --- GỌI API LẤY ALL ĐỂ VẼ BIỂU ĐỒ ---
  const { data: allTransactions } = useQuery({
    queryKey: ['cashbook-all', wid, from, to],
    queryFn: () => financeService.getCashbook(wid, from, to).then(r => r.data.data),
    enabled: (isAdmin() || !!wid) && tab === 'cashbook',
  });

  // API LẤY SỔ QUỸ (SERVER-SIDE PAGINATION)
  const { data: cashbookData, isLoading: loadingTxn, isRefetching: refetchingTxn } = useQuery({
    queryKey: ['cashbook-search', wid, from, to, filterFund, filterType, filterRef, debouncedKeywordTxn, pageTxn],
    queryFn: () => financeService.searchCashbook({
      warehouseId: wid,
      from,
      to,
      fundType: filterFund,
      transactionType: filterType,
      keyword: filterRef !== 'ALL' ? filterRef : debouncedKeywordTxn, 
      page: pageTxn,
      size: PAGE_SIZE
    }).then(r => r.data.data),
    enabled: (isAdmin() || !!wid) && tab === 'cashbook',
  });

  const paginatedTxn = cashbookData?.content || [];
  const totalPagesTxn = cashbookData?.totalPages || 0;
  const totalElementsTxn = cashbookData?.totalElements || 0;

  // API CÔNG NỢ
  const { data: debts, isLoading: loadingDebts, isRefetching: refetchingDebts } = useQuery({
    queryKey: ['supplier-debts', wid],
    queryFn: () => financeService.getOutstandingDebts(wid).then(r => r.data.data),
    enabled: tab === 'debts',
  });

  const { data: suppliers } = useQuery({ 
      queryKey: ['suppliers'], 
      queryFn: () => supplierService.getAll().then(r => r.data.data.content),
      enabled: tab === 'debts', 
  });

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    if (suppliers) {
      suppliers.forEach((s: any) => map.set(s.id, s.name));
    }
    return map;
  }, [suppliers]);

  const filteredDebts = useMemo(() => {
    if (!debts) return [];
    if (!keywordDebt.trim()) return debts;
    const lower = keywordDebt.toLowerCase();
    
    return debts.filter((d: any) => {
      const supplierName = supplierMap.get(d.supplierId)?.toLowerCase() || '';
      return supplierName.includes(lower) ||
        d.purchaseOrderCode?.toLowerCase().includes(lower) ||
        d.purchaseOrderId?.toLowerCase().includes(lower) ||
        d.status.toLowerCase().includes(lower) ||
        d.totalDebt.toString().includes(lower) ||
        d.remainingAmount.toString().includes(lower);
    });
  }, [debts, keywordDebt, supplierMap]);

  const paginatedDebts = useMemo(() => {
    const start = pageDebt * PAGE_SIZE;
    return filteredDebts.slice(start, start + PAGE_SIZE);
  }, [filteredDebts, pageDebt]);
  const totalPagesDebt = Math.ceil(filteredDebts.length / PAGE_SIZE);

  // --- XỬ LÝ DỮ LIỆU VẼ BIỂU ĐỒ CHART ---
  const chartData = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return [];
    
    const grouped: Record<string, { rawDate: string; date: string; Thu: number; Chi: number }> = {};

    allTransactions.forEach((t: any) => {
      if (filterFund !== 'ALL' && t.fundType !== filterFund) return;
      if (filterType !== 'ALL' && t.transactionType !== filterType) return;
      if (filterRef !== 'ALL' && t.referenceType !== filterRef) return;

      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const display = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!grouped[key]) {
        grouped[key] = { rawDate: key, date: display, Thu: 0, Chi: 0 };
      }
      
      if (t.transactionType === 'IN') {
        grouped[key].Thu += t.amount;
      } else {
        grouped[key].Chi += t.amount;
      }
    });

    return Object.values(grouped).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [allTransactions, filterFund, filterType, filterRef]);

  // --- TÍNH NĂNG XUẤT EXCEL (CSV) ---
  const handleExportExcel = async () => {
    const exportToast = toast.loading("Đang chuẩn bị dữ liệu xuất...");
    try {
      let csvContent = "";
      let filename = "";

      if (tab === 'cashbook') {
        const res = await financeService.searchCashbook({
          warehouseId: wid,
          from,
          to,
          fundType: filterFund,
          transactionType: filterType,
          keyword: filterRef !== 'ALL' ? filterRef : debouncedKeywordTxn, 
          page: 0,
          size: 100000 
        });
        const fullData = res.data.data.content;

        csvContent = "Ngày,Quỹ,Loại,Chứng từ,Mô tả,Số tiền\n" +
          fullData.map((t: any) => {
            const date = formatDateTime(t.createdAt);
            const fund = t.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng';
            const type = t.transactionType === 'IN' ? 'Thu' : 'Chi';
            const amount = t.amount;
            const ref = t.referenceType || '';
            const desc = `"${t.description?.replace(/"/g, '""') || ''}"`; 
            return `${date},${fund},${type},${ref},${desc},${amount}`;
          }).join("\n");
        filename = `So_Quy_${new Date().getTime()}.csv`;
      } else {
         csvContent = "Nhà cung cấp,Chi nhánh,Đơn nhập (PO),Tổng nợ,Đã trả,Còn lại,Trạng thái,Hạn TT\n" +
          filteredDebts.map((d: any) => {
            const ncc = `"${supplierMap.get(d.supplierId) || 'Không rõ'}"`;
            const whName = d.warehouseName || 'Không rõ';
            const po = d.purchaseOrderCode || d.purchaseOrderId || '-';
            const total = d.totalDebt;
            const paid = d.paidAmount;
            const remain = d.remainingAmount;
            const status = d.status;
            const dueDate = d.dueDate || '-';
            return `${ncc},${whName},${po},${total},${paid},${remain},${status},${dueDate}`;
          }).join("\n");
        filename = `Cong_No_${new Date().getTime()}.csv`;
      }

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Đã xuất file thành công!", { id: exportToast });
    } catch (error) {
      toast.error("Lỗi khi tải dữ liệu xuất", { id: exportToast });
    }
  };

  // --- TÍNH NĂNG IN PHIẾU THU / CHI ---
  const handlePrintReceipt = (txn: any) => {
    const typeStr = txn.transactionType === 'IN' ? 'PHIẾU THU' : 'PHIẾU CHI';
    const personStr = txn.transactionType === 'IN' ? 'Người nộp tiền' : 'Người nhận tiền';
    const date = new Date(txn.createdAt);
    const dateStr = `Ngày ${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')} năm ${date.getFullYear()}`;

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>In ${typeStr}</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; color: #000; padding: 40px; font-size: 15px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .title { text-align: center; margin-bottom: 20px; }
          .title h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .title p { margin: 5px 0 0; font-style: italic; }
          .content table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .content td { padding: 8px 0; vertical-align: top; }
          .label { width: 150px; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
          .signature-box { width: 30%; }
          .signature-title { font-weight: bold; margin-bottom: 5px; }
          .signature-sub { font-style: italic; font-size: 13px; color: #555; }
          .amount { font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="header">
          <div>
            <strong>ĐƠN VỊ: HỆ THỐNG CỬA HÀNG</strong><br/>
            <span>Mã chi nhánh: ${wid || 'Trung tâm'}</span>
          </div>
          <div style="text-align: right;">
            <strong>Mẫu số: 01-TT / 02-TT</strong><br/>
            <span>(Ban hành theo Thông tư 200/2014/TT-BTC)</span>
          </div>
        </div>
        
        <div class="title">
          <h1>${typeStr}</h1>
          <p>${dateStr}</p>
        </div>

        <div class="content">
          <table>
            <tr><td class="label">Mã chứng từ:</td><td>${txn.referenceType || '-'}</td></tr>
            <tr><td class="label">Loại quỹ:</td><td>${txn.fundType === 'CASH_111' ? 'Tiền mặt (TK 111)' : 'Ngân hàng (TK 112)'}</td></tr>
            <tr><td class="label">Lý do:</td><td>${txn.description || '-'}</td></tr>
            <tr><td class="label">Số tiền:</td><td class="amount">${formatCurrency(txn.amount)}</td></tr>
          </table>
        </div>

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-title">Người lập phiếu</div>
            <div class="signature-sub">(Ký, họ tên)</div>
          </div>
          <div class="signature-box">
            <div class="signature-title">${personStr}</div>
            <div class="signature-sub">(Ký, họ tên)</div>
          </div>
          <div class="signature-box">
            <div class="signature-title">Thủ quỹ</div>
            <div class="signature-sub">(Ký, họ tên)</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    } else {
      toast.error("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép Pop-up.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tài chính & Công nợ</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi dòng tiền thu chi và quản lý công nợ Nhà cung cấp.</p>
        </div>
      </div>

      {/* ── THẺ TỔNG QUAN TÀI CHÍNH ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-5 transition-all hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors duration-700"></div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100/60 transition-transform group-hover:scale-110 relative z-10">
            <Banknote className="w-7 h-7" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quỹ Tiền mặt <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded ml-1.5 text-slate-500">TK 111</span></p>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(balance?.CASH_111 ?? 0)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-5 transition-all hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-50 rounded-full blur-2xl group-hover:bg-blue-100 transition-colors duration-700"></div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100/60 transition-transform group-hover:scale-110 relative z-10">
            <Landmark className="w-7 h-7" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quỹ Ngân hàng <span className="font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded ml-1.5 text-slate-500">TK 112</span></p>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(balance?.BANK_112 ?? 0)}</p>
          </div>
        </div>

        <div className="bg-indigo-600 p-6 rounded-3xl shadow-[0_8px_30px_rgb(99,102,241,0.2)] border border-indigo-500 flex items-center gap-5 transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="p-4 bg-white/10 text-white rounded-2xl shadow-inner border border-white/10 transition-transform group-hover:scale-110 relative z-10">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider mb-1">Tổng Quỹ Hiện Có</p>
            <p className="text-3xl font-black text-white tracking-tight drop-shadow-sm">{formatCurrency((balance?.CASH_111 ?? 0) + (balance?.BANK_112 ?? 0))}</p>
          </div>
        </div>
      </div>

      {/* ── ĐIỀU HƯỚNG TABS & MAIN CONTENT ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden animate-fade-in flex flex-col min-h-[500px]">
        
        {/* Tabs Header */}
        <div className="flex border-b border-slate-100 px-6 sm:px-8 bg-slate-50/30 overflow-x-auto custom-scrollbar shrink-0 gap-6">
          <button 
            onClick={() => setTab('cashbook')}
            className={`py-5 font-bold text-[15px] flex items-center gap-2 transition-all relative whitespace-nowrap ${tab === 'cashbook' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <DollarSign className="w-4 h-4" /> Sổ Quỹ Giao Dịch
            {tab === 'cashbook' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_0_8px_rgb(99,102,241,0.8)]"></div>}
          </button>
          <button 
            onClick={() => setTab('debts')}
            className={`py-5 font-bold text-[15px] flex items-center gap-2 transition-all relative whitespace-nowrap ${tab === 'debts' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <AlertCircle className="w-4 h-4" /> Công nợ Nhà cung cấp
            {tab === 'debts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_0_8px_rgb(99,102,241,0.8)]"></div>}
          </button>
        </div>

        {/* ── NỘI DUNG TAB SỔ QUỸ ── */}
        {tab === 'cashbook' && (
          <div className="flex flex-col flex-1 animate-fade-in">
            {/* Bộ lọc Sổ Quỹ */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col gap-6 bg-white shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-extrabold text-slate-900 hidden lg:flex items-center gap-2 text-xl tracking-tight">
                  <TrendingUp className="w-5 h-5 text-indigo-500" /> Biến động dòng tiền
                </h3>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <button onClick={handleExportExcel} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất Data</span>
                  </button>
                  <button onClick={() => setShowEntryModal(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[0_4px_12px_rgb(99,102,241,0.3)] flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tạo Phiếu Mới</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-11 pr-4 py-3 transition-colors outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm" 
                    placeholder={filterRef !== 'ALL' ? "Đang lọc nguồn..." : "Mô tả, mã chứng từ..."} 
                    value={keywordTxn} 
                    onChange={e => setKeywordTxn(e.target.value)} 
                    disabled={filterRef !== 'ALL'}
                  />
                </div>
                <div className="relative">
                  <select className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3 transition-colors outline-none cursor-pointer appearance-none shadow-sm" value={filterFund} onChange={e => setFilterFund(e.target.value)}>
                    <option value="ALL">Tất cả Loại quỹ</option>
                    <option value="CASH_111">Tiền mặt (TK 111)</option>
                    <option value="BANK_112">Ngân hàng (TK 112)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select className={`w-full border text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3 transition-colors outline-none cursor-pointer appearance-none shadow-sm ${filterType === 'ALL' ? 'bg-white border-slate-200 text-slate-700' : filterType === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="ALL">Tất cả Thu / Chi</option>
                    <option value="IN">Chỉ lọc Thu (+)</option>
                    <option value="OUT">Chỉ lọc Chi (-)</option>
                  </select>
                  <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${filterType === 'ALL' ? 'text-slate-400' : filterType === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`} />
                </div>
                <div className="relative">
                  <select className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-4 py-3 transition-colors outline-none cursor-pointer appearance-none shadow-sm" value={filterRef} onChange={e => { setFilterRef(e.target.value); if (e.target.value !== 'ALL') setKeywordTxn(''); }}>
                    <option value="ALL">Tất cả Nguồn gốc</option>
                    <option value="INVOICE">Hóa đơn POS</option>
                    <option value="SALE_ONLINE">Đơn Online</option>
                    <option value="PURCHASE_ORDER">Nhập kho NCC</option>
                    <option value="SUPPLIER_PAYMENT">Trả nợ NCC</option>
                    <option value="COD_RECONCILIATION">Đối soát COD</option>
                    <option value="EXPENSE">Chi phí vận hành</option>
                    <option value="OTHER_INCOME">Thu nhập khác</option>
                    <option value="MANUAL">Thủ công</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                  <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-11 pr-10 py-3 transition-colors outline-none cursor-pointer appearance-none shadow-sm">
                    <option value="today">Hôm nay</option>
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="year">Năm nay</option>
                    <option value="30days">30 ngày qua</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Biểu đồ Sổ Quỹ */}
            {chartData.length > 0 && !loadingTxn && (
              <div className="px-8 py-6 border-b border-slate-100 bg-white hidden lg:block shrink-0">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                      <YAxis 
                        yAxisId="left" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} 
                        tickFormatter={(value) => `${value / 1000000}M`} 
                        dx={-10}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={<CustomTooltip />}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold', color: '#64748b' }} iconType="circle" />
                      <Bar yAxisId="left" dataKey="Thu" name="Tiền Thu (+)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={30} />
                      <Bar yAxisId="left" dataKey="Chi" name="Tiền Chi (-)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Bảng dữ liệu Sổ Quỹ */}
            <div className="relative flex-1 flex flex-col bg-slate-50/30">
              {loadingTxn || refetchingTxn ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Spinner size="lg" className="text-indigo-600" />
                </div>
              ) : null}
              <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-sm text-left min-w-[900px] text-slate-600">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-5">Thời gian</th>
                      <th className="px-6 py-5 text-center">Quỹ</th>
                      <th className="px-6 py-5 text-center">Loại</th>
                      <th className="px-6 py-5">Mã tham chiếu</th>
                      <th className="px-6 py-5">Mô tả giao dịch</th>
                      <th className="px-6 py-5 text-right">Số tiền</th>
                      <th className="px-6 py-5 text-right w-24">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {paginatedTxn.length === 0 && !loadingTxn ? (
                      <tr><td colSpan={7} className="py-24 text-center"><EmptyState icon={FileText} title="Không có giao dịch nào" description="Thử thay đổi bộ lọc hoặc khoảng thời gian." /></td></tr>
                    ) : (
                      paginatedTxn.map((txn: any) => (
                        <tr key={txn.id} className="hover:bg-white transition-colors group">
                          <td className="px-6 py-4 text-slate-500 font-semibold text-xs whitespace-nowrap">{formatDateTime(txn.createdAt)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${txn.fundType === 'CASH_111' ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' : 'bg-blue-50 text-blue-700 border-blue-100/60'}`}>
                              {txn.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {txn.transactionType === 'IN'
                              ? <span className="inline-flex items-center justify-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm border border-emerald-200/50"><TrendingUp className="w-3.5 h-3.5" /> Thu</span>
                              : <span className="inline-flex items-center justify-center gap-1 bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm border border-rose-200/50"><TrendingDown className="w-3.5 h-3.5" /> Chi</span>
                            }
                          </td>
                          <td className="px-6 py-4 font-mono text-[13px] font-bold text-slate-700">{txn.referenceType}</td>
                          <td className="px-6 py-4 text-[14px] font-medium text-slate-800 max-w-[300px] truncate" title={txn.description}>{txn.description}</td>
                          <td className={`px-6 py-4 text-right font-black tracking-tight text-base ${txn.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {txn.transactionType === 'IN' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handlePrintReceipt(txn)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 bg-white hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-100 hover:border-indigo-100 opacity-0 group-hover:opacity-100 ml-auto"
                              title="In phiếu"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPagesTxn > 1 && (
                <div className="border-t border-slate-100 bg-white p-4 shrink-0 rounded-b-3xl">
                  <Pagination page={pageTxn} totalPages={totalPagesTxn} totalElements={totalElementsTxn} size={PAGE_SIZE} onPageChange={setPageTxn} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NỘI DUNG TAB CÔNG NỢ NCC ── */}
        {tab === 'debts' && (
          <div className="flex flex-col flex-1 animate-fade-in">
            {/* Bộ lọc Công Nợ */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white shrink-0">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-11 pr-4 py-3.5 transition-colors outline-none shadow-sm" 
                  placeholder="Tìm Tên NCC, mã PO, trạng thái nợ..." 
                  value={keywordDebt} 
                  onChange={e => setKeywordDebt(e.target.value)} 
                />
              </div>
              <button onClick={handleExportExcel} className="px-6 py-3.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
                <Download className="w-4 h-4" /> Xuất Báo Cáo
              </button>
            </div>

            {/* Bảng dữ liệu Công Nợ */}
            <div className="relative flex-1 flex flex-col bg-slate-50/30">
              {loadingDebts || refetchingDebts ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Spinner size="lg" className="text-indigo-600" />
                </div>
              ) : null}
              <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-sm text-left min-w-[1000px] text-slate-600">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-5">Nhà cung cấp</th>
                      <th className="px-6 py-5">Chi nhánh</th>
                      <th className="px-6 py-5 text-center">Mã Phiếu (PO)</th>
                      <th className="px-6 py-5 text-right">Tổng phát sinh</th>
                      <th className="px-6 py-5 text-right text-emerald-600">Đã trả</th>
                      <th className="px-6 py-5 text-right text-rose-600">Còn nợ lại</th>
                      <th className="px-6 py-5 text-center">Trạng thái</th>
                      <th className="px-6 py-5 text-right w-40">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {paginatedDebts.length === 0 && !loadingDebts ? (
                      <tr><td colSpan={8} className="py-24 text-center"><EmptyState icon={AlertCircle} title="Không có công nợ nào" description="Tuyệt vời! Không có khoản nợ nào cần thanh toán." /></td></tr>
                    ) : (
                      paginatedDebts.map((d: any) => (
                        <tr key={d.id} className="hover:bg-white transition-colors group">
                          <td className="px-6 py-4 font-extrabold text-slate-900 text-[14px]">
                            {supplierMap.get(d.supplierId) || <span className="text-[11px] font-medium text-slate-400 italic">Không rõ NCC</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider">
                              {d.warehouseName || 'Không rõ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-bold text-indigo-600 text-[13px]">
                            {d.purchaseOrderCode || (d.purchaseOrderId ? d.purchaseOrderId.slice(0,8) + '...' : '-')}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-700 tracking-tight text-[15px]">{formatCurrency(d.totalDebt)}</td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600 tracking-tight text-[15px]">{formatCurrency(d.paidAmount)}</td>
                          <td className="px-6 py-4 text-right font-black text-rose-600 tracking-tight text-[16px]">{formatCurrency(d.remainingAmount)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${d.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : d.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-rose-50 text-rose-700 border-rose-200/60'}`}>
                              {d.status === 'PAID' ? 'Đã Thanh Toán' : d.status === 'PARTIAL' ? 'Trả Một Phần' : 'Chưa Thanh Toán'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setDebtHistory(d)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 bg-white border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
                                title="Xem lịch sử trả nợ"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              
                              {d.status !== 'PAID' && (
                                <button 
                                  onClick={() => setDebtToPay(d)}
                                  className="h-8 px-4 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 shadow-sm"
                                  title="Thanh toán nợ"
                                >
                                  Trả nợ
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
              {totalPagesDebt > 1 && (
                <div className="border-t border-slate-100 bg-white p-4 shrink-0 rounded-b-3xl">
                  <Pagination page={pageDebt} totalPages={totalPagesDebt} totalElements={filteredDebts.length} size={PAGE_SIZE} onPageChange={setPageDebt} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── RENDER CÁC MODAL ── */}
      {showEntryModal && (
        <CashbookEntryModal 
          onClose={() => setShowEntryModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['cashbook-search'] });
            qc.invalidateQueries({ queryKey: ['cashbook-all'] });
            qc.invalidateQueries({ queryKey: ['cashbook-balance'] });
          }}
        />
      )}

      {debtToPay && (
        <PayDebtModal 
          debt={debtToPay}
          onClose={() => setDebtToPay(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['supplier-debts'] });
            qc.invalidateQueries({ queryKey: ['cashbook-search'] });
            qc.invalidateQueries({ queryKey: ['cashbook-all'] });
            qc.invalidateQueries({ queryKey: ['cashbook-balance'] });
            qc.invalidateQueries({ queryKey: ['debt-history'] });
          }}
        />
      )}

      {debtHistory && (
        <DebtHistoryModal 
          debt={debtHistory}
          onClose={() => setDebtHistory(null)}
        />
      )}
    </div>
  );
}