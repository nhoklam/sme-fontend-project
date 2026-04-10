import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Calendar, Search, Plus, X, CheckCircle, Download, Printer, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { financeService } from '@/services/finance.service';
import { warehouseService } from '@/services/warehouse.service';
import { supplierService } from '@/services/supplier.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Spinner, Pagination } from '@/components/ui';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TimeRange = 'today' | 'week' | 'month' | 'year' | '30days';

// --- COMPONENT 1: MODAL TẠO PHIẾU THU/CHI ---
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-fade-in">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="font-bold text-lg">Tạo Phiếu Thu/Chi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isAdmin() && (
            <div>
              <label className="label">Chi nhánh *</label>
              <select className="input" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                <option value="">-- Chọn chi nhánh --</option>
                {(warehouses ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Loại phiếu</label>
              <select className="input" value={form.transactionType} onChange={e => setForm({ ...form, transactionType: e.target.value })}>
                <option value="IN">Phiếu Thu</option>
                <option value="OUT">Phiếu Chi</option>
              </select>
            </div>
            <div>
              <label className="label">Loại quỹ</label>
              <select className="input" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
                <option value="CASH_111">Tiền mặt</option>
                <option value="BANK_112">Ngân hàng</option>
              </select>
            </div>
            <div>
              <label className="label">Loại chứng từ</label>
              <select className="input" value={form.referenceType} onChange={e => setForm({ ...form, referenceType: e.target.value })}>
                <option value="MANUAL">Thủ công</option>
                <option value="EXPENSE">Chi phí vận hành</option>
                <option value="OTHER_INCOME">Thu nhập khác</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Số tiền *</label>
            <input type="number" className="input" placeholder="Nhập số tiền..." value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Lý do / Mô tả *</label>
            <textarea className="input resize-none" rows={3} placeholder="Ví dụ: Nộp tiền điện nước..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.amount || !form.warehouseId || !form.description.trim()} className="btn-primary">
            {mut.isPending ? <Spinner size="sm" /> : 'Xác nhận tạo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT 2: MODAL THANH TOÁN CÔNG NỢ ---
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="font-bold text-lg">Thanh toán Công nợ</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
            <span className="text-sm text-blue-800">Dư nợ cần thanh toán:</span>
            <span className="font-bold text-blue-700">{formatCurrency(debt.remainingAmount)}</span>
          </div>

          <div>
            <label className="label">Thanh toán từ quỹ *</label>
            <select className="input" value={form.fundType} onChange={e => setForm({ ...form, fundType: e.target.value })}>
              <option value="CASH_111">Tiền mặt (TK111)</option>
              <option value="BANK_112">Ngân hàng (TK112)</option>
            </select>
          </div>
          <div>
            <label className="label">Số tiền trả (VNĐ) *</label>
            <input type="number" className="input" max={debt.remainingAmount} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <textarea className="input resize-none" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.amount || Number(form.amount) <= 0 || Number(form.amount) > debt.remainingAmount} className="btn-primary">
            {mut.isPending ? <Spinner size="sm" /> : 'Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT 3: MODAL LỊCH SỬ THANH TOÁN CÔNG NỢ ---
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-fade-in flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h3 className="font-bold text-lg">
            Lịch sử thanh toán - Đơn <span className="font-mono text-primary-600">{debt.purchaseOrderCode || debt.purchaseOrderId?.slice(0,8)}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? <div className="flex justify-center py-8"><Spinner size="md" /></div> : (
            <div className="table-wrapper border-0 border-b border-gray-200 rounded-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày trả</th>
                    <th>Loại quỹ</th>
                    <th>Số tiền</th>
                    <th>Ghi chú / Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-sm">Chưa có lịch sử thanh toán nào cho đơn này</td></tr>
                  ) : (
                    payments.map((p: any) => (
                      <tr key={p.id}>
                        <td className="text-gray-500 text-sm">{formatDateTime(p.createdAt)}</td>
                        <td>
                          <span className={`badge text-xs ${p.fundType === 'CASH_111' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {p.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}
                          </span>
                        </td>
                        <td className="font-bold text-green-600">{formatCurrency(p.amount)}</td>
                        <td className="text-sm text-gray-600">{p.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-5 border-t flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const { warehouseId, isAdmin } = useAuthStore();
  const wid = warehouseId() ?? '';
  const qc = useQueryClient(); 
  const PAGE_SIZE = 10;

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
  const { data: cashbookData, isLoading: loadingTxn } = useQuery({
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
  const { data: debts, isLoading: loadingDebts } = useQuery({
    queryKey: ['supplier-debts', wid],
    queryFn: () => financeService.getOutstandingDebts(wid).then(r => r.data.data),
    enabled: tab === 'debts',
  });

  const { data: suppliers } = useQuery({ 
      queryKey: ['suppliers'], 
      queryFn: () => supplierService.getAll().then(r => r.data.data.content), // Thêm .content vào đây
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
      toast.error("Lỗi khi tải dữ liệu xuất Excel", { id: exportToast });
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

  // --- RENDER ---
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-gray-500 text-sm">Quỹ Tiền mặt (TK111)</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(balance?.CASH_111 ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-gray-500 text-sm">Quỹ Ngân hàng (TK112)</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(balance?.BANK_112 ?? 0)}</p>
        </div>
        <div className="card p-5 bg-primary-50">
          <p className="text-primary-600 text-sm font-medium">Tổng cộng</p>
          <p className="text-2xl font-bold text-primary-700 mt-1">{formatCurrency((balance?.CASH_111 ?? 0) + (balance?.BANK_112 ?? 0))}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {[{ id: 'cashbook', label: 'Sổ quỹ' }, { id: 'debts', label: 'Công nợ NCC' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}
      {tab === 'cashbook' && (
        <div className="card">
          {/* ĐÃ SỬA LẠI: Áp dụng CSS Grid để phân tách 5 cột bộ lọc, không bị cuộn ngang */}
          <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
            
            {/* Hàng 1: Tiêu đề & Nút thao tác */}
            <div className="flex justify-between items-center w-full">
              <h3 className="font-semibold text-gray-800 hidden sm:flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" /> Sổ quỹ
              </h3>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleExportExcel} className="btn-secondary py-1.5 px-3 text-sm flex-1 sm:flex-none justify-center">
                  <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Xuất Excel</span>
                </button>

                <button onClick={() => setShowEntryModal(true)} className="btn-primary py-1.5 px-3 text-sm flex-1 sm:flex-none justify-center">
                  <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Tạo phiếu</span>
                </button>
              </div>
            </div>

            {/* Hàng 2: Bộ lọc (Sử dụng CSS Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
              
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  className="input pl-9 text-sm py-1.5 w-full disabled:bg-gray-100 disabled:cursor-not-allowed" 
                  placeholder={filterRef !== 'ALL' ? "Đang lọc theo nguồn..." : "Tìm mô tả, mã..."} 
                  value={keywordTxn} 
                  onChange={e => setKeywordTxn(e.target.value)} 
                  disabled={filterRef !== 'ALL'}
                  title={filterRef !== 'ALL' ? "Hãy chuyển 'Loại nguồn' về Tất cả để tìm kiếm" : ""}
                />
              </div>

              <select className="input text-sm py-1.5 w-full" value={filterFund} onChange={e => setFilterFund(e.target.value)}>
                <option value="ALL">Tất cả quỹ</option>
                <option value="CASH_111">Tiền mặt</option>
                <option value="BANK_112">Ngân hàng</option>
              </select>

              <select className="input text-sm py-1.5 w-full" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="ALL">Cả Thu/Chi</option>
                <option value="IN">Chỉ Thu</option>
                <option value="OUT">Chỉ Chi</option>
              </select>

              <select className="input text-sm py-1.5 w-full" value={filterRef} onChange={e => {
                setFilterRef(e.target.value);
                if (e.target.value !== 'ALL') setKeywordTxn('');
              }}>
                <option value="ALL">Tất cả nguồn</option>
                <option value="INVOICE">Hóa đơn POS</option>
                <option value="SALE_ONLINE">Đơn hàng Online</option>
                <option value="PURCHASE_ORDER">Nhập kho</option>
                <option value="SUPPLIER_PAYMENT">Trả nợ NCC</option>
                <option value="COD_RECONCILIATION">Đối soát COD</option>
                <option value="EXPENSE">Chi phí vận hành</option>
                <option value="OTHER_INCOME">Thu nhập khác</option>
                <option value="MANUAL">Thủ công</option>
              </select>

              <div className="flex items-center gap-2 w-full bg-white border border-gray-300 rounded-lg px-3 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="w-full text-sm border-none bg-transparent focus:ring-0 py-1.5 outline-none cursor-pointer">
                  <option value="today">Hôm nay</option>
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                  <option value="year">Năm nay</option>
                  <option value="30days">30 ngày qua</option>
                </select>
              </div>

            </div>
          </div>
          
          {chartData.length > 0 && !loadingTxn && (
            <div className="p-5 border-b border-gray-200 bg-gray-50/30 hidden lg:block">
              <h4 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Biểu đồ Lưu chuyển tiền tệ (VNĐ)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                    <YAxis 
                      yAxisId="left" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#6b7280' }} 
                      tickFormatter={(value) => `${value / 1000000}M`} 
                    />
                    <Tooltip
                      cursor={{ fill: '#f3f4f6' }}
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="Thu" name="Tiền Thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="Chi" name="Tiền Chi" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {loadingTxn ? <div className="p-8 flex justify-center"><Spinner size="lg" /></div> : (
            <>
              <div className="table-wrapper border-0 border-b border-gray-200 rounded-none">
                <table className="table">
                  <thead><tr><th>Ngày</th><th>Quỹ</th><th>Loại</th><th>Chứng từ</th><th>Mô tả</th><th>Số tiền</th><th className="text-right">Thao tác</th></tr></thead>
                  <tbody>
                    {paginatedTxn.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-gray-400 text-sm">Không tìm thấy giao dịch nào phù hợp với bộ lọc</td></tr>
                    ) : (
                      paginatedTxn.map((txn: any) => (
                        <tr key={txn.id}>
                          <td className="text-gray-500 text-xs whitespace-nowrap">{formatDateTime(txn.createdAt)}</td>
                          <td><span className={`badge text-xs ${txn.fundType === 'CASH_111' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{txn.fundType === 'CASH_111' ? 'Tiền mặt' : 'Ngân hàng'}</span></td>
                          <td>
                            {txn.transactionType === 'IN'
                              ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><TrendingUp className="w-3 h-3" />Thu</span>
                              : <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><TrendingDown className="w-3 h-3" />Chi</span>}
                          </td>
                          <td className="text-xs text-gray-500 font-mono">{txn.referenceType}</td>
                          <td className="text-sm text-gray-600 max-w-[200px] truncate" title={txn.description}>{txn.description}</td>
                          <td className={`font-bold ${txn.transactionType === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                            {txn.transactionType === 'IN' ? '+' : '-'}{formatCurrency(txn.amount)}
                          </td>
                          <td className="text-right">
                            <button 
                              onClick={() => handlePrintReceipt(txn)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
              {totalPagesTxn > 1 && <Pagination page={pageTxn} totalPages={totalPagesTxn} totalElements={totalElementsTxn} size={PAGE_SIZE} onPageChange={setPageTxn} />}
            </>
          )}
        </div>
      )}

      {tab === 'debts' && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
            
            <div className="flex justify-between items-center w-full">
              <h3 className="font-semibold flex items-center gap-2 whitespace-nowrap text-gray-800">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Công nợ Nhà cung cấp
              </h3>
              <button onClick={handleExportExcel} className="btn-secondary py-1.5 px-3 text-sm">
                <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Xuất Excel</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div className="relative w-full lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9 text-sm py-1.5 w-full" placeholder="Tìm Tên NCC, PO, trạng thái..." value={keywordDebt} onChange={e => setKeywordDebt(e.target.value)} />
              </div>
            </div>

          </div>

          {loadingDebts ? <div className="p-8 flex justify-center"><Spinner size="lg" /></div> : (
            <>
              <div className="table-wrapper border-0 border-b border-gray-200 rounded-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nhà cung cấp</th>
                      <th>Chi nhánh</th>
                      <th>Đơn nhập (PO)</th>
                      <th>Tổng nợ</th>
                      <th>Đã trả</th>
                      <th>Còn lại</th>
                      <th>Trạng thái</th>
                      <th>Hạn TT</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDebts.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-6 text-gray-400 text-sm">Không tìm thấy công nợ nào</td></tr>
                    ) : (
                      paginatedDebts.map((d: any) => (
                        <tr key={d.id}>
                          <td className="font-medium text-sm text-gray-800">
                            {supplierMap.get(d.supplierId) || <span className="text-xs text-gray-400 italic">Không rõ NCC</span>}
                          </td>
                          <td>
                            <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md text-xs">
                              {d.warehouseName || 'Không rõ'}
                            </span>
                          </td>
                          <td className="text-xs text-gray-600 font-mono">
                            {d.purchaseOrderCode || (d.purchaseOrderId ? d.purchaseOrderId.slice(0,8) + '...' : '-')}
                          </td>
                          <td className="font-semibold">{formatCurrency(d.totalDebt)}</td>
                          <td className="text-green-600">{formatCurrency(d.paidAmount)}</td>
                          <td className={`font-bold ${d.remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(d.remainingAmount)}</td>
                          <td><span className={`badge text-xs ${d.status === 'PAID' ? 'bg-green-100 text-green-700' : d.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{d.status}</span></td>
                          <td className="text-gray-500 text-xs">{d.dueDate ?? '-'}</td>
                          
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => setDebtHistory(d)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                                title="Xem lịch sử trả nợ"
                              >
                                <History className="w-3.5 h-3.5" /> Lịch sử
                              </button>
                              
                              {d.status !== 'PAID' && (
                                <button 
                                  onClick={() => setDebtToPay(d)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Trả nợ
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
              {totalPagesDebt > 1 && <Pagination page={pageDebt} totalPages={totalPagesDebt} totalElements={filteredDebts.length} size={PAGE_SIZE} onPageChange={setPageDebt} />}
            </>
          )}
        </div>
      )}

      {/* RENDER CÁC MODAL */}
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