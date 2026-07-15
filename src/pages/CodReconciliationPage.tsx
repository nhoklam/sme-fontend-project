import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Search, CheckCircle2, AlertCircle, Upload,
  Truck, X, Building2, Download, Printer, Calendar, FileSpreadsheet, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { startOfDay, endOfDay } from 'date-fns';

import { financeService } from '@/services/finance.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageLoader, EmptyState, Spinner, Pagination } from '@/components/ui';
import { CodReconciliationPrintTemplate } from './CodReconciliationPrintTemplate';
import type { CodReconciliationResult } from '@/types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface CodOrder {
  id: string;
  code: string;
  customerName?: string;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  codReconciled: boolean;
  assignedWarehouseId: string;
  assignedWarehouseName?: string;
  shippingProvider?: string;
  trackingCode?: string;
  createdAt: string;
}

interface ReconcileRow {
  orderCode: string;
  amountReceived: number;
  shippingFee: number;
  shippingProvider: string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS CHO IMPORT EXCEL DOANH NGHIỆP
// ─────────────────────────────────────────────────────────────
// Xóa bỏ tất cả ký tự không phải số (vd: "350,000 đ" -> 350000)
const parseAmountStrict = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^\d-]/g, '');
  return parseInt(cleaned, 10) || 0;
};

// Tìm giá trị dựa trên nhiều alias tên cột khác nhau
const getColValue = (row: any, possibleKeys: string[]) => {
  for (const key of possibleKeys) {
    // Duyệt qua từng key trong row, convert về lowercase để so sánh cho chắc chắn
    const matchedKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey];
    }
  }
  return null;
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function CodReconciliationPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [debouncedSearchKw, setDebouncedSearchKw] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [amountMap, setAmountMap] = useState<Record<string, number>>({});
  const [feeMap, setFeeMap] = useState<Record<string, number>>({});
  const [providerMap, setProviderMap] = useState<Record<string, string>>({});
  
  const [isImporting, setIsImporting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<CodReconciliationResult | null>(null);

  // --- STATE CHO PREVIEW IMPORT EXCEL ---
  const [importPreview, setImportPreview] = useState<{
    validItems: any[];
    notFoundCodes: string[];
    totalExcelAmount: number;
    fileName: string;
  } | null>(null);

  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKw(searchKw);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKw]);

  const resetSelection = () => {
    setSelectedOrders(new Set());
    setAmountMap({});
    setFeeMap({});
    setProviderMap({});
    setPage(0);
  };

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-cod'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const { data: ordersPage, isLoading } = useQuery({
    queryKey: ['cod-unreconciled', selectedWarehouseId, fromDate, toDate, debouncedSearchKw, page],
    queryFn: () => financeService.getPendingCod({
      warehouseId: selectedWarehouseId || undefined,
      from: fromDate ? startOfDay(new Date(fromDate)).toISOString() : undefined,
      to: toDate ? endOfDay(new Date(toDate)).toISOString() : undefined,
      keyword: debouncedSearchKw || undefined,
      page,
      size: PAGE_SIZE,
    }).then(r => r.data.data),
    enabled: !!selectedWarehouseId, 
  });

  const codOrders = (ordersPage?.content ?? []) as CodOrder[];

  const toggleAll = () => {
    if (selectedOrders.size === codOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(codOrders.map(o => o.code)));
    }
  };

  const totalSelected = [...selectedOrders].reduce((sum, code) => {
    const order = codOrders.find(o => o.code === code);
    return sum + (amountMap[code] ?? (order?.finalAmount ?? 0));
  }, 0);

  const totalFee = [...selectedOrders].reduce((sum, code) => {
    return sum + (feeMap[code] ?? 0);
  }, 0);

  const reconMut = useMutation({
    mutationFn: () => {
      if (!selectedWarehouseId) throw new Error('Chọn chi nhánh trước');
      const rows: ReconcileRow[] = [...selectedOrders].map(code => {
        const order = codOrders.find(o => o.code === code);
        return {
          orderCode: code,
          amountReceived: amountMap[code] ?? (order?.finalAmount ?? 0),
          shippingFee: feeMap[code] ?? 0,
          shippingProvider: providerMap[code] ?? (order?.shippingProvider ?? 'Khác'),
        };
      });
      return financeService.reconcileCOD(rows, selectedWarehouseId).then(r => r.data.data);
    },
    onSuccess: (result) => {
      setLastResult(result);
      setShowResult(true);
      resetSelection();
      toast.success(`Đối soát thành công ${result.matched} đơn!`);
      qc.invalidateQueries({ queryKey: ['cod-unreconciled'] });
      qc.invalidateQueries({ queryKey: ['cashbook-search'] });
      qc.invalidateQueries({ queryKey: ['cashbook-balance'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi đối soát'),
  });

  // =========================================================================
  // LOGIC ĐỌC FILE EXCEL CẢI TIẾN
  // =========================================================================
  const handleReadExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedWarehouseId) { 
      toast.error('Vui lòng chọn chi nhánh trước khi nhập file'); 
      if (fileInputRef.current) fileInputRef.current.value = '';
      return; 
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        if (rows.length === 0) {
          toast.error('File Excel không có dữ liệu.');
          return;
        }

        const validItems: any[] = [];
        const notFoundCodes: string[] = [];
        let totalExcelAmount = 0;

        // Các Alias cột phổ biến của các ĐVVC (GHTK, ViettelPost, J&T, SPX...)
        const codeAlias = ['Mã đơn hàng', 'Mã vận đơn', 'orderCode', 'Mã ĐH', 'Mã tham chiếu', 'Mã đơn khách hàng', 'Mã Đơn', 'Tracking Number'];
        const amountAlias = ['Số tiền COD', 'Tiền thu hộ', 'amountReceived', 'Tổng thu COD', 'Tiền COD', 'Thu hộ', 'Khách trả'];
        const feeAlias = ['Phí vận chuyển', 'Phí ship', 'shippingFee', 'Cước phí', 'Tổng cước', 'Phí dịch vụ'];
        const providerAlias = ['Đơn vị vận chuyển', 'ĐVVC', 'Nhà vận chuyển', 'shippingProvider', 'Hãng vận chuyển'];

        rows.forEach((row) => {
          const rawCode = String(getColValue(row, codeAlias) ?? '').trim();
          if (!rawCode) return; // Bỏ qua dòng trống

          const amountVal = getColValue(row, amountAlias);
          const feeVal = getColValue(row, feeAlias);
          const providerVal = getColValue(row, providerAlias);

          const order = codOrders.find(o => o.code === rawCode || o.trackingCode === rawCode);
          
          if (!order) {
            notFoundCodes.push(rawCode);
          } else {
            const parsedAmount = amountVal !== null ? parseAmountStrict(amountVal) : order.finalAmount;
            const parsedFee = feeVal !== null ? parseAmountStrict(feeVal) : 0;
            
            totalExcelAmount += parsedAmount;
            
            validItems.push({
              code: order.code,
              amount: parsedAmount,
              fee: parsedFee,
              provider: String(providerVal ?? order.shippingProvider ?? '').trim(),
            });
          }
        });

        if (validItems.length === 0 && notFoundCodes.length > 0) {
          toast.error(`Không tìm thấy đơn nào trùng khớp trên hệ thống ở trang này.`);
        }

        // Hiện màn hình Preview thay vì Apply trực tiếp
        setImportPreview({
          validItems,
          notFoundCodes,
          totalExcelAmount,
          fileName: file.name
        });

      } catch (err) {
        console.error("Excel Parsing Error:", err);
        toast.error('File không đúng định dạng. Vui lòng kiểm tra lại.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Xác nhận Áp dụng dữ liệu từ Modal Preview vào UI
  const handleConfirmImport = () => {
    if (!importPreview) return;

    const nextSelected = new Set(selectedOrders);
    const nextFee = { ...feeMap };
    const nextProvider = { ...providerMap };
    const nextAmount = { ...amountMap };

    importPreview.validItems.forEach((item) => {
      nextSelected.add(item.code);
      nextAmount[item.code] = item.amount;
      nextFee[item.code] = item.fee;
      if (item.provider) nextProvider[item.code] = item.provider;
    });

    setSelectedOrders(nextSelected);
    setFeeMap(nextFee);
    setProviderMap(nextProvider);
    setAmountMap(nextAmount);
    
    toast.success(`Đã đánh dấu chọn ${importPreview.validItems.length} đơn hàng.`);
    setImportPreview(null);
  };

  const handleDownloadTemplate = () => {
    const sample = [{ 'Mã đơn hàng': 'ORD-2024...', 'Số tiền COD': 350000, 'Phí vận chuyển': 20000, 'Đơn vị vận chuyển': 'GHTK' }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MauDoiSoat');
    XLSX.writeFile(wb, 'Mau_Doi_Soat_COD.xlsx');
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Bien_Ban_Doi_Soat_COD_${new Date().toISOString().slice(0,10)}`,
  });

  const handleExportExcel = () => {
    if (!lastResult) return;
    const excelData = lastResult.items.map((it, i) => ({
      'STT': i + 1, 'Mã đơn': it.orderCode, 'Khách hàng': it.customerName,
      'ĐVVC': it.shippingProvider, 'Tiền COD': it.amountReceived,
      'Phí ship': it.shippingFee, 'Thực nhận': it.netAmount,
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DoiSoatCOD');
    XLSX.writeFile(wb, `Doi_Soat_COD_${new Date().getTime()}.xlsx`);
  };

  const allChecked = codOrders.length > 0 && selectedOrders.size === codOrders.length;
  const someChecked = selectedOrders.size > 0 && selectedOrders.size < codOrders.length;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-8 h-8 text-indigo-600" />
            Đối soát COD (Kế toán)
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">
            Xác nhận thanh toán từ đối tác vận chuyển cho các đơn COD đã giao thành công.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={handleReadExcelFile} accept=".xlsx,.xls,.csv" className="hidden" />
          <button 
            onClick={handleDownloadTemplate} 
            className="text-sm font-semibold text-indigo-600 underline hover:text-indigo-800 transition-colors"
          >
            Tải file mẫu
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting || !selectedWarehouseId}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isImporting ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />} Tải lên file đối soát
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] p-5 flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="w-full lg:w-64 shrink-0">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chi nhánh *</label>
          <select
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-slate-50 transition-all cursor-pointer"
            value={selectedWarehouseId}
            onChange={e => { setSelectedWarehouseId(e.target.value); resetSelection(); }}
          >
            <option value="">-- Chọn chi nhánh --</option>
            {(warehouses ?? []).map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 w-full lg:w-auto flex-1">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Từ ngày (Ngày giao)</label>
            <div className="relative">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                 type="date" 
                 value={fromDate} 
                 onChange={e => { setFromDate(e.target.value); resetSelection(); }}
                 className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white transition-all font-medium text-slate-700" 
               />
            </div>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đến ngày</label>
            <div className="relative">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                 type="date" 
                 value={toDate} 
                 onChange={e => { setToDate(e.target.value); resetSelection(); }}
                 className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white transition-all font-medium text-slate-700" 
               />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tìm kiếm đơn hàng</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-11 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
              placeholder="Nhập mã đơn, mã VĐ..."
              value={searchKw}
              onChange={e => setSearchKw(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!selectedWarehouseId && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200/60 rounded-xl text-sm font-semibold text-amber-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Vui lòng chọn chi nhánh bên trên để hệ thống tải danh sách đơn COD cần đối soát.
        </div>
      )}

      {/* Action bar Floating */}
      {selectedOrders.size > 0 && (
        <div className="bg-indigo-600 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-5 shadow-[0_8px_30px_rgb(99,102,241,0.3)] sticky top-20 z-40 animate-slide-up border border-indigo-500">
          <div className="flex-1 text-center md:text-left">
            <p className="text-lg font-black text-white">
              Đã tick chọn {selectedOrders.size} đơn — Tổng thu: {formatCurrency(totalSelected)}
            </p>
            {totalFee > 0 && (
              <p className="text-sm text-indigo-100 font-medium mt-1">
                Phí vận chuyển: {formatCurrency(totalFee)} — Thực nhận vào sổ: <span className="font-bold text-white">{formatCurrency(totalSelected - totalFee)}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => reconMut.mutate()}
            disabled={reconMut.isPending || !selectedWarehouseId}
            className="flex items-center gap-2 px-8 py-3 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors w-full md:w-auto justify-center"
          >
            {reconMut.isPending ? <Spinner size="sm" className="text-indigo-600" /> : <CheckCircle2 className="w-5 h-5" />}
            Xác nhận Ghi sổ quỹ ({selectedOrders.size})
          </button>
        </div>
      )}

      {/* Table */}
      {!selectedWarehouseId ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] p-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Building2 className="w-10 h-10 text-slate-300" /></div>
          <p className="text-slate-500 font-semibold text-lg">Chưa chọn chi nhánh</p>
          <p className="text-slate-400 text-sm mt-1">Chọn chi nhánh ở bộ lọc để bắt đầu công việc.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600">Đang hiển thị {codOrders.length} / {ordersPage?.totalElements ?? 0} đơn chờ đối soát</span>
          </div>

          <div className="overflow-x-auto relative min-h-[400px]">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
            
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin đơn</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-44">Tiền thu được từ ĐVVC</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left w-44">ĐVVC</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-36">Phí ship</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thực nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80">
                {codOrders.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <EmptyState icon={CheckCircle2} title="Không có đơn COD" description="Đã đối soát xong hoặc không có đơn khớp với bộ lọc." />
                    </td>
                  </tr>
                ) : (
                  codOrders.map(order => {
                    const isSelected = selectedOrders.has(order.code);
                    const currentAmt = amountMap[order.code] ?? order.finalAmount;
                    const currentFee = feeMap[order.code] ?? 0;
                    
                    return (
                      <tr
                        key={order.id}
                        className={cn('transition-colors cursor-pointer', isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80')}
                        onClick={() => {
                          const next = new Set(selectedOrders);
                          if (next.has(order.code)) next.delete(order.code);
                          else next.add(order.code);
                          setSelectedOrders(next);
                        }}
                      >
                        <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedOrders);
                              if (next.has(order.code)) next.delete(order.code);
                              else next.add(order.code);
                              setSelectedOrders(next);
                            }}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900 font-mono text-[14px]">{order.code}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1">{order.customerName ?? 'Khách lẻ'}</p>
                          {order.trackingCode && (
                            <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/60 mt-1.5 w-max flex items-center gap-1">
                              <Truck className="w-3 h-3" />{order.trackingCode}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Giao: {formatDate(order.createdAt)}</p>
                        </td>
                        
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <div className="relative group/input">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₫</span>
                            <input
                              type="number" min={0} step={1000}
                              className={`w-full border rounded-xl pl-3 pr-7 py-2.5 text-sm font-black text-right outline-none transition-all ${
                                currentAmt !== order.finalAmount 
                                  ? 'border-amber-400 bg-amber-50 text-amber-700 focus:ring-2 focus:ring-amber-500/20' 
                                  : 'border-slate-200 bg-white text-emerald-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 group-hover/input:border-slate-300'
                              }`}
                              value={amountMap[order.code] ?? order.finalAmount}
                              onChange={e => setAmountMap(prev => ({ ...prev, [order.code]: parseAmountStrict(e.target.value) }))}
                            />
                          </div>
                          {currentAmt !== order.finalAmount && <p className="text-[10px] text-amber-600 font-bold text-right mt-1">Lệch so với hệ thống</p>}
                        </td>

                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white transition-all hover:border-slate-300"
                            placeholder="GHTK, Viettel..."
                            value={providerMap[order.code] ?? (order.shippingProvider ?? '')}
                            onChange={e => setProviderMap(prev => ({ ...prev, [order.code]: e.target.value }))}
                          />
                        </td>

                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <div className="relative group/input">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₫</span>
                            <input
                              type="number" min={0} step={1000}
                              className="w-full border border-slate-200 rounded-xl pl-3 pr-7 py-2.5 text-sm font-bold text-slate-700 text-right focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white transition-all hover:border-slate-300"
                              placeholder="0"
                              value={feeMap[order.code] ?? ''}
                              onChange={e => setFeeMap(prev => ({ ...prev, [order.code]: parseAmountStrict(e.target.value) }))}
                            />
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <span className="font-black text-slate-900 text-[15px] tracking-tight">{formatCurrency(currentAmt - currentFee)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {ordersPage && ordersPage.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <Pagination page={page} totalPages={ordersPage.totalPages} totalElements={ordersPage.totalElements} size={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {/* PREVIEW IMPORT MODAL (CẢI TIẾN) */}
      {importPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                     <FileSpreadsheet className="w-5 h-5"/>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-900">Kiểm duyệt File Đối soát</h2>
                    <p className="text-xs text-slate-500 font-medium">File: {importPreview.fileName}</p>
                  </div>
               </div>
               <button onClick={() => setImportPreview(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5"/>
               </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Đơn hợp lệ</p>
                  <p className="text-3xl font-black text-emerald-700">{importPreview.validItems.length}</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Tổng tiền: <strong className="text-emerald-700">{formatCurrency(importPreview.totalExcelAmount)}</strong></p>
                </div>
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Không tìm thấy</p>
                  <p className="text-3xl font-black text-rose-700">{importPreview.notFoundCodes.length}</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Mã VĐ không khớp hoặc đã đối soát</p>
                </div>
              </div>

              {importPreview.notFoundCodes.length > 0 && (
                <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm mb-3">
                    <AlertTriangle className="w-4 h-4"/> 
                    Các mã không hợp lệ ({importPreview.notFoundCodes.length})
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                    {importPreview.notFoundCodes.map((code, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-rose-50 text-rose-700 font-mono text-[11px] rounded-lg border border-rose-100">
                        {code}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3 italic">* Hệ thống sẽ tự động bỏ qua các mã này khi bạn áp dụng.</p>
                </div>
              )}

              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl text-[13px] text-blue-800 font-medium shadow-sm">
                Nếu bạn bấm xác nhận, hệ thống sẽ tự động <strong>điền số tiền, phí ship và tick chọn</strong> {importPreview.validItems.length} đơn hàng trên màn hình. Bạn vẫn cần bấm "Ghi nhận Đối soát" ở bước cuối cùng.
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
               <button onClick={() => setImportPreview(null)} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                  Hủy bỏ
               </button>
               <button 
                  onClick={handleConfirmImport} 
                  disabled={importPreview.validItems.length === 0}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-[0_4px_12px_rgb(99,102,241,0.3)] transition-colors disabled:opacity-50"
               >
                  Xác nhận Áp dụng dữ liệu
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal & Xuất In */}
      {showResult && lastResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="bg-emerald-500 p-8 text-center relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-3 relative z-10" />
              <h2 className="text-2xl font-black text-white tracking-tight relative z-10">Đối soát hoàn tất!</h2>
            </div>
            
            <div className="p-8 space-y-4 bg-slate-50/30 flex-1">
              {[
                { label: 'Đơn đối soát thành công', value: lastResult.matched, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Không tìm thấy (bỏ qua)', value: lastResult.notFound, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Tổng tiền nhận từ ĐVVC', value: formatCurrency(lastResult.totalReceived), color: 'text-indigo-700', bg: 'bg-transparent border-b' },
                { label: 'Trừ Phí vận chuyển', value: formatCurrency(lastResult.totalShippingFee), color: 'text-amber-600', bg: 'bg-transparent border-b' },
                { label: 'Thực nhận (Vào Sổ Quỹ)', value: formatCurrency(lastResult.netAmount), color: 'text-emerald-700 text-lg', bg: 'bg-emerald-50 border border-emerald-100' },
              ].map(s => (
                <div key={s.label} className={cn("flex items-center justify-between py-3 px-4 rounded-xl", s.bg)}>
                  <span className="text-sm font-semibold text-slate-600">{s.label}</span>
                  <span className={cn('font-black tracking-tight', s.color)}>{s.value}</span>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex flex-col gap-3 shrink-0">
              <div className="flex gap-3">
                <button onClick={handleExportExcel} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors">
                  <Download className="w-4 h-4"/> Excel
                </button>
                <button onClick={() => handlePrint()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 border border-slate-200/60 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                  <Printer className="w-4 h-4"/> In biên bản
                </button>
              </div>
              <button onClick={() => setShowResult(false)} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 transition-colors">
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ẩn khối Template Print */}
      <div className="hidden">
        <CodReconciliationPrintTemplate
          ref={printRef}
          result={lastResult!}
          warehouseName={warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name ?? ''}
          reconciledByName={user?.fullName ?? ''}
        />
      </div>

    </div>
  );
}