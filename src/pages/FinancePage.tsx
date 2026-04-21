import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Calendar, Search, Plus, X, CheckCircle, Download, Printer, History, Landmark, Banknote, Wallet, FileText, CreditCard } from 'lucide-react';
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl animate-slide-up overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Tạo Phiếu Thu / Chi</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Ghi nhận giao dịch thủ công vào hệ thống</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          {isAdmin() && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Chi nhánh <span className="text-rose-500">*</span></label>
              <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium cursor-pointer appearance-none" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                <option value="">-- Chọn chi nhánh --</option>
                {(warehouses ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Loại phiếu</label>
              <select className={`w-full border text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none cursor-pointer appearance-none ${form.transactionType === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`} value={form.transactionType} onChange={e => setForm({ ...form, transactionType: e.target.value })}>
                <option value="IN">Phiếu Thu (+)</option>
                <option value="OUT">Phiếu Chi (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Loại quỹ</label>
              <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium cursor-pointer appearance-none" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
                <option value="CASH_111">Tiền mặt (TK111)</option>
                <option value="BANK_112">Ngân hàng (TK112)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Loại chứng từ</label>
              <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium cursor-pointer appearance-none" value={form.referenceType} onChange={e => setForm({ ...form, referenceType: e.target.value })}>
                <option value="MANUAL">Thủ công</option>
                <option value="EXPENSE">Chi phí vận hành</option>
                <option value="OTHER_INCOME">Thu nhập khác</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Số tiền (VNĐ) <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              className={`w-full bg-white border text-2xl font-black tracking-tight rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none ${form.transactionType === 'IN' ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200'}`} 
              placeholder="Nhập số tiền..." 
              value={form.amount} 
              onChange={e => setForm({ ...form, amount: e.target.value })} 
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Lý do / Mô tả <span className="text-rose-500">*</span></label>
            <textarea className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium resize-none" rows={3} placeholder="Ví dụ: Nộp tiền điện nước, Tiền rác, v.v..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.amount || !form.warehouseId || !form.description.trim()} 
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[130px]"
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md animate-slide-up overflow-hidden border border-slate-100 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Thanh toán Công nợ</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">PO: <span className="font-mono font-bold text-indigo-600 uppercase">{debt.purchaseOrderCode || debt.purchaseOrderId?.slice(0,8)}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5 bg-slate-50/30">
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex justify-between items-center shadow-sm">
            <span className="text-sm font-bold text-rose-800">Dư nợ cần thanh toán:</span>
            <span className="font-black tracking-tight text-rose-600 text-xl">{formatCurrency(debt.remainingAmount)}</span>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Số tiền trả (VNĐ) <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              className="w-full bg-white border border-slate-200 text-slate-900 text-xl font-black tracking-tight rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none" 
              max={debt.remainingAmount} 
              value={form.amount} 
              onChange={e => setForm({ ...form, amount: e.target.value })} 
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Thanh toán từ quỹ <span className="text-rose-500">*</span></label>
            <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none font-medium cursor-pointer appearance-none" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
              <option value="CASH_111">Tiền mặt (TK111)</option>
              <option value="BANK_112">Ngân hàng (TK112)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Ghi chú thanh toán</label>
            <textarea className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium resize-none" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.amount || Number(form.amount) <= 0 || Number(form.amount) > debt.remainingAmount} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[140px]">
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl animate-slide-up flex flex-col max-h-[85vh] border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Lịch sử thanh toán</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">PO: <span className="font-mono font-bold text-indigo-600 uppercase">{debt.purchaseOrderCode || debt.purchaseOrderId?.slice(0,8)}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">
          <div className="border border-slate-100 rounded-xl overflow-hidden m-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Ngày trả</th>
                  <th className="px-4 py-3">Loại quỹ</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Ghi chú / Mô tả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-10"><Spinner size="md" className="mx-auto text-indigo-600"/></td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-500 font-medium">Chưa có lịch sử thanh toán nào cho đơn này</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-600 font-medium text-xs">{formatDateTime(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${p.fundType === 'CASH_111' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {p.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-[15px] tracking-tight text-emerald-600 text-right">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 text-[13px] text-slate-600 max-w-[200px] truncate" title={p.description}>{p.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors">Đóng cửa sổ</button>
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
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-600" /> Tài chính & Công nợ
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi dòng tiền thu chi và quản lý công nợ Nhà cung cấp</p>
        </div>
      </div>

      {/* ── THẺ TỔNG QUAN TÀI CHÍNH ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl ring-4 ring-emerald-50/50 transition-transform group-hover:scale-110">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quỹ Tiền mặt <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded ml-1 text-slate-400">TK111</span></p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(balance?.CASH_111 ?? 0)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl ring-4 ring-blue-50/50 transition-transform group-hover:scale-110">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quỹ Ngân hàng <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded ml-1 text-slate-400">TK112</span></p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(balance?.BANK_112 ?? 0)}</p>
          </div>
        </div>

        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-md group">
          <div className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-transform group-hover:scale-110">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-indigo-600/80 uppercase tracking-wider mb-1">Tổng Quỹ Hiện Có</p>
            <p className="text-2xl font-black text-indigo-700 tracking-tight">{formatCurrency((balance?.CASH_111 ?? 0) + (balance?.BANK_112 ?? 0))}</p>
          </div>
        </div>
      </div>

      {/* ── ĐIỀU HƯỚNG TABS ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100 px-2 sm:px-6 bg-slate-50/50 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setTab('cashbook')}
            className={`py-4 px-4 font-bold text-[14px] flex items-center gap-2 transition-all relative whitespace-nowrap ${tab === 'cashbook' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <DollarSign className="w-4 h-4" /> Sổ Quỹ Giao Dịch
            {tab === 'cashbook' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setTab('debts')}
            className={`py-4 px-4 font-bold text-[14px] flex items-center gap-2 transition-all relative whitespace-nowrap ${tab === 'debts' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <AlertCircle className="w-4 h-4" /> Công nợ Nhà cung cấp
            {tab === 'debts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
        </div>

        {/* ── NỘI DUNG TAB SỔ QUỸ ── */}
        {tab === 'cashbook' && (
          <div className="flex flex-col animate-fade-in">
            {/* Bộ lọc Sổ Quỹ */}
            <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-900 hidden sm:flex items-center gap-2 text-lg">
                  Lịch sử Thu Chi
                </h3>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <button onClick={handleExportExcel} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất Data</span>
                  </button>
                  <button onClick={() => setShowEntryModal(true)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 flex-1 sm:flex-none">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tạo Phiếu Mới</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                    placeholder={filterRef !== 'ALL' ? "Đang lọc nguồn..." : "Mô tả, mã chứng từ..."} 
                    value={keywordTxn} 
                    onChange={e => setKeywordTxn(e.target.value)} 
                    disabled={filterRef !== 'ALL'}
                  />
                </div>
                <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-3 p-2.5 transition-colors outline-none cursor-pointer appearance-none" value={filterFund} onChange={e => setFilterFund(e.target.value)}>
                  <option value="ALL">Tất cả Loại quỹ</option>
                  <option value="CASH_111">Tiền mặt (TK111)</option>
                  <option value="BANK_112">Ngân hàng (TK112)</option>
                </select>
                <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-3 p-2.5 transition-colors outline-none cursor-pointer appearance-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="ALL">Tất cả Thu / Chi</option>
                  <option value="IN">Chỉ lọc Thu (+)</option>
                  <option value="OUT">Chỉ lọc Chi (-)</option>
                </select>
                <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block px-3 p-2.5 transition-colors outline-none cursor-pointer appearance-none" value={filterRef} onChange={e => { setFilterRef(e.target.value); if (e.target.value !== 'ALL') setKeywordTxn(''); }}>
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
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none">
                    <option value="today">Hôm nay</option>
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="year">Năm nay</option>
                    <option value="30days">30 ngày qua</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Biểu đồ Sổ Quỹ */}
            {chartData.length > 0 && !loadingTxn && (
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 hidden lg:block">
                <h4 className="text-sm font-extrabold text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-indigo-500" /> Biểu đồ Giao dịch
                </h4>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                      <YAxis 
                        yAxisId="left" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} 
                        tickFormatter={(value) => `${value / 1000000}M`} 
                        dx={-10}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }} iconType="circle" />
                      <Bar yAxisId="left" dataKey="Thu" name="Tiền Thu (+)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      <Bar yAxisId="left" dataKey="Chi" name="Tiền Chi (-)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Bảng dữ liệu Sổ Quỹ */}
            <div className="relative min-h-[300px] flex flex-col">
              {loadingTxn || refetchingTxn ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Spinner size="lg" className="text-indigo-600" />
                </div>
              ) : null}
              <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                <table className="w-full text-sm text-left min-w-[900px]">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4">Thời gian</th>
                      <th className="px-5 py-4 text-center">Quỹ</th>
                      <th className="px-5 py-4 text-center">Loại</th>
                      <th className="px-5 py-4">Mã tham chiếu</th>
                      <th className="px-5 py-4">Mô tả giao dịch</th>
                      <th className="px-5 py-4 text-right">Số tiền</th>
                      <th className="px-5 py-4 text-right">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedTxn.length === 0 && !loadingTxn ? (
                      <tr><td colSpan={7} className="py-16 text-center text-slate-500 font-medium">Không tìm thấy giao dịch nào phù hợp.</td></tr>
                    ) : (
                      paginatedTxn.map((txn: any) => (
                        <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 text-slate-600 font-medium text-xs whitespace-nowrap">{formatDateTime(txn.createdAt)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${txn.fundType === 'CASH_111' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {txn.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {txn.transactionType === 'IN'
                              ? <span className="inline-flex items-center justify-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><TrendingUp className="w-3 h-3" /> Thu</span>
                              : <span className="inline-flex items-center justify-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><TrendingDown className="w-3 h-3" /> Chi</span>
                            }
                          </td>
                          <td className="px-5 py-4 font-mono text-[12px] font-semibold text-slate-500">{txn.referenceType}</td>
                          <td className="px-5 py-4 text-[13px] font-medium text-slate-800 max-w-[250px] truncate" title={txn.description}>{txn.description}</td>
                          <td className={`px-5 py-4 text-right font-black tracking-tight text-[15px] ${txn.transactionType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {txn.transactionType === 'IN' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button 
                              onClick={() => handlePrintReceipt(txn)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-transparent hover:border-indigo-100 ml-auto"
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
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <Pagination page={pageTxn} totalPages={totalPagesTxn} totalElements={totalElementsTxn} size={PAGE_SIZE} onPageChange={setPageTxn} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NỘI DUNG TAB CÔNG NỢ NCC ── */}
        {tab === 'debts' && (
          <div className="flex flex-col animate-fade-in">
            {/* Bộ lọc Công Nợ */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none" 
                  placeholder="Tìm Tên NCC, PO, trạng thái nợ..." 
                  value={keywordDebt} 
                  onChange={e => setKeywordDebt(e.target.value)} 
                />
              </div>
              <button onClick={handleExportExcel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
                <Download className="w-4 h-4" /> Xuất Excel
              </button>
            </div>

            {/* Bảng dữ liệu Công Nợ */}
            <div className="relative min-h-[300px] flex flex-col">
              {loadingDebts || refetchingDebts ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Spinner size="lg" className="text-indigo-600" />
                </div>
              ) : null}
              <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                <table className="w-full text-sm text-left min-w-[1000px]">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4">Nhà cung cấp</th>
                      <th className="px-5 py-4">Chi nhánh nhập</th>
                      <th className="px-5 py-4 text-center">Mã Phiếu (PO)</th>
                      <th className="px-5 py-4 text-right">Tổng phát sinh</th>
                      <th className="px-5 py-4 text-right text-emerald-600">Đã trả</th>
                      <th className="px-5 py-4 text-right text-rose-600">Còn nợ lại</th>
                      <th className="px-5 py-4 text-center">Trạng thái</th>
                      <th className="px-5 py-4 text-center">Hạn thanh toán</th>
                      <th className="px-5 py-4 text-right">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedDebts.length === 0 && !loadingDebts ? (
                      <tr><td colSpan={9} className="py-16 text-center text-slate-500 font-medium">Không tìm thấy công nợ nào.</td></tr>
                    ) : (
                      paginatedDebts.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-5 py-4 font-bold text-slate-800 text-[13px]">
                            {supplierMap.get(d.supplierId) || <span className="text-[11px] font-medium text-slate-400 italic">Không rõ NCC</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider">
                              {d.warehouseName || 'Không rõ'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-mono font-bold text-indigo-600 text-[12px]">
                            {d.purchaseOrderCode || (d.purchaseOrderId ? d.purchaseOrderId.slice(0,8) + '...' : '-')}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-slate-700 tracking-tight">{formatCurrency(d.totalDebt)}</td>
                          <td className="px-5 py-4 text-right font-semibold text-emerald-600 tracking-tight">{formatCurrency(d.paidAmount)}</td>
                          <td className="px-5 py-4 text-right font-black text-rose-600 tracking-tight text-[15px]">{formatCurrency(d.remainingAmount)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${d.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : d.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {d.status === 'PAID' ? 'Đã Thanh Toán' : d.status === 'PARTIAL' ? 'Trả Một Phần' : 'Chưa Thanh Toán'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center text-slate-500 text-xs font-medium">{d.dueDate ?? '-'}</td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2 items-center opacity-80 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setDebtHistory(d)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-200 hover:text-slate-800 transition-colors shadow-sm"
                                title="Xem lịch sử trả nợ"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              
                              {d.status !== 'PAID' && (
                                <button 
                                  onClick={() => setDebtToPay(d)}
                                  className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 shadow-sm"
                                  title="Thanh toán nợ"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Trả nợ
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
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
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