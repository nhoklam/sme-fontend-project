import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Plus, Search, ChevronRight, CheckCircle2, Clock,
  XCircle, PlayCircle, AlertTriangle, X, Save, CheckCheck,
  MapPin, ChevronDown, ScanLine, FileText, Trash2, PackagePlus, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import AsyncSelect from 'react-select/async';
import * as XLSX from 'xlsx';

import { stockTakeService } from '@/services/stock-take.service';
import { warehouseService } from '@/services/warehouse.service';
import { productService } from '@/services/product.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatDate } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT:       { label: 'Nháp',         color: 'bg-slate-100 text-slate-600',    icon: FileText },
  IN_PROGRESS: { label: 'Đang đếm',     color: 'bg-blue-100 text-blue-700',      icon: PlayCircle },
  COMPLETED:   { label: 'Chờ duyệt',    color: 'bg-amber-100 text-amber-700',    icon: Clock },
  APPROVED:    { label: 'Đã duyệt',     color: 'bg-emerald-100 text-emerald-700',icon: CheckCircle2 },
  CANCELLED:   { label: 'Đã hủy',       color: 'bg-red-100 text-red-600',        icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function DiscrepancyBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300 text-xs">—</span>;
  if (value === 0)    return <span className="text-emerald-600 font-semibold text-sm">✓</span>;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold',
      value > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
    )}>
      {value > 0 ? '+' : ''}{value}
    </span>
  );
}

// ĐÃ SỬA: Bỏ điều kiện chặn độ dài, thêm isActive: true
const loadProductOptions = async (inputValue: string) => {
  try {
    const res = await productService.getProducts({ keyword: inputValue || undefined, size: 50, isActive: true });
    return res.data.data.content.map((p: any) => ({
      value: p.id,
      label: `${p.isbnBarcode ? '[' + p.isbnBarcode + '] ' : ''}${p.name}`
    }));
  } catch (error) {
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// DETAIL MODAL
// ─────────────────────────────────────────────────────────────
function StockTakeDetailModal({
  stockTakeId, onClose,
}: { stockTakeId: string; onClose: () => void }) {
  const qc = useQueryClient();

  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [searchItem, setSearchItem] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [productToAdd, setProductToAdd] = useState<any>(null);

  const { data: st, isLoading } = useQuery({
    queryKey: ['stock-take', stockTakeId],
    queryFn: () => stockTakeService.getById(stockTakeId).then(r => r.data.data),
    refetchInterval: 10_000,
  });

  const mutStart    = useMutation({ mutationFn: () => stockTakeService.start(stockTakeId),   onSuccess: (r) => { qc.setQueryData(['stock-take', stockTakeId], r.data.data); qc.invalidateQueries({ queryKey: ['stock-takes'] }); toast.success('Bắt đầu kiểm kê!'); } });
  const mutComplete = useMutation({ mutationFn: () => stockTakeService.complete(stockTakeId), onSuccess: (r) => { qc.setQueryData(['stock-take', stockTakeId], r.data.data); qc.invalidateQueries({ queryKey: ['stock-takes'] }); toast.success('Hoàn thành kiểm kê!'); } });
  const mutApprove  = useMutation({
    mutationFn: () => stockTakeService.approve(stockTakeId, approveNote || undefined),
    onSuccess: (r) => {
      qc.setQueryData(['stock-take', stockTakeId], r.data.data);
      qc.invalidateQueries({ queryKey: ['stock-takes'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Duyệt thành công! Tồn kho đã được điều chỉnh.');
      setShowApproveConfirm(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi duyệt'),
  });
  const mutCancel = useMutation({
    mutationFn: () => stockTakeService.cancel(stockTakeId, cancelReason),
    onSuccess: (r) => {
      qc.setQueryData(['stock-take', stockTakeId], r.data.data);
      qc.invalidateQueries({ queryKey: ['stock-takes'] });
      toast.success('Đã hủy phiếu kiểm kê');
      setShowCancelInput(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi hủy'),
  });
  const mutSave = useMutation({
    mutationFn: () => {
      const counts = Object.entries(pendingCounts).map(([productId, actualQuantity]) => ({ productId, actualQuantity }));
      return stockTakeService.updateCount(stockTakeId, counts);
    },
    onSuccess: (r) => {
      qc.setQueryData(['stock-take', stockTakeId], r.data.data);
      setPendingCounts({});
      toast.success(`Đã lưu ${Object.keys(pendingCounts).length} dòng`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi lưu'),
  });

  const mutAddProduct = useMutation({
    mutationFn: () => stockTakeService.addProducts(stockTakeId, [productToAdd.value]),
    onSuccess: (r) => {
      qc.setQueryData(['stock-take', stockTakeId], r.data.data);
      setProductToAdd(null);
      toast.success('Đã thêm sản phẩm vào phiếu');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi thêm sản phẩm'),
  });

  const mutRemoveProduct = useMutation({
    mutationFn: (productId: string) => stockTakeService.removeProduct(stockTakeId, productId),
    onSuccess: (r) => {
      qc.setQueryData(['stock-take', stockTakeId], r.data.data);
      toast.success('Đã xóa sản phẩm khỏi phiếu');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi xóa sản phẩm'),
  });

  const filteredItems = useMemo(() => {
    if (!st?.items) return [];
    const kw = searchItem.toLowerCase();
    return st.items.filter((i: any) =>
      !kw || i.productName?.toLowerCase().includes(kw) || i.isbnBarcode?.includes(kw)
    );
  }, [st?.items, searchItem]);

  const hasUnsaved = Object.keys(pendingCounts).length > 0;
  
  const filledCount = st?.items.filter((i: any) => {
    const pending = pendingCounts[i.productId];
    return pending !== undefined ? true : i.actualQuantity !== null;
  }).length ?? 0;
  
  const totalCount  = st?.items.length ?? 0;
  const progress    = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const handleSafeClose = () => {
    if (hasUnsaved) {
      if (window.confirm('Bạn có dữ liệu chưa lưu. Bạn có chắc chắn muốn đóng và MẤT dữ liệu này không?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleComplete = async () => {
    if (hasUnsaved) {
      try {
        await mutSave.mutateAsync();
      } catch (e) {
        return; 
      }
    }
    mutComplete.mutate();
  };

  const handleExportDetail = () => {
    if (!st || !st.items) return;
    const excelData = st.items.map((i: any, index: number) => ({
      'STT': index + 1,
      'Sản phẩm': i.productName,
      'Mã vạch / SKU': i.isbnBarcode || '',
      'Tồn hệ thống': i.systemQuantity,
      'Thực tế': i.actualQuantity ?? 'Chưa đếm',
      'Chênh lệch': i.discrepancy ?? '—'
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ChiTietKiemKe");
    XLSX.writeFile(wb, `Chi_Tiet_Kiem_Kho_${st.code}.xlsx`);
    toast.success('Đã xuất file Excel!');
  };

  if (isLoading) return (
    <ModalShell onClose={handleSafeClose} title="Đang tải...">
      <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
    </ModalShell>
  );
  if (!st) return null;

  const canEdit   = st.status === 'IN_PROGRESS';
  const canStart  = st.status === 'DRAFT';
  const canFinish = st.status === 'IN_PROGRESS' && progress === 100;
  const canApprove = st.status === 'COMPLETED';
  const canCancel = st.status === 'DRAFT' || st.status === 'IN_PROGRESS';

  return (
    <ModalShell onClose={handleSafeClose} title={`Phiếu Kiểm kê #${st.code}`} wide>
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <StatusBadge status={st.status} />
        <span className="text-slate-500">Tạo: <span className="font-medium text-slate-700">{st.createdByName}</span></span>
        <span className="text-slate-500">{formatDate(st.createdAt)}</span>
        {st.completedAt && <span className="text-slate-500">Hoàn thành: <span className="font-medium text-slate-700">{formatDate(st.completedAt)}</span></span>}
        {st.approvedByName && <span className="text-slate-500">Duyệt bởi: <span className="font-medium text-emerald-700">{st.approvedByName}</span></span>}
      </div>

      {(st.status === 'IN_PROGRESS' || st.status === 'COMPLETED') && (
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Tiến độ nhập liệu</span>
            <span className="text-xs font-bold text-slate-700">{filledCount}/{totalCount} sản phẩm ({progress}%)</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
          {st.discrepancyItems > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {st.discrepancyItems} sản phẩm có chênh lệch so với hệ thống
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4 flex flex-col">
        {st.status === 'DRAFT' && (
          <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1.5">Bổ sung sản phẩm vào phiếu</label>
              <AsyncSelect 
                cacheOptions 
                defaultOptions // ĐÃ THÊM
                loadOptions={loadProductOptions} 
                value={productToAdd}
                onChange={setProductToAdd}
                placeholder="Gõ tên hoặc mã vạch để tìm..."
                className="text-sm font-medium"
                noOptionsMessage={() => "Không tìm thấy sản phẩm"} // ĐÃ THÊM
              />
            </div>
            <button 
              onClick={() => mutAddProduct.mutate()}
              disabled={!productToAdd || mutAddProduct.isPending}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[38px] flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {mutAddProduct.isPending ? <Spinner size="sm" className="text-white"/> : <PackagePlus className="w-4 h-4"/>}
              Thêm
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
              placeholder="Tìm theo tên sách, ISBN trong phiếu..."
              value={searchItem}
              onChange={e => setSearchItem(e.target.value)}
            />
          </div>
          {hasUnsaved && (
            <button
              onClick={() => mutSave.mutate()}
              disabled={mutSave.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutSave.isPending ? <Spinner size="sm" className="text-white" /> : <Save className="w-4 h-4" />}
              Lưu ({Object.keys(pendingCounts).length})
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40%]">Sản phẩm</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Hệ thống</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Thực tế</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Chênh lệch</th>
                {st.status === 'DRAFT' && <th className="w-12"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={st.status === 'DRAFT' ? 5 : 4} className="text-center py-12 text-slate-400 text-sm">Không có sản phẩm nào</td></tr>
              ) : filteredItems.map((item: any) => {
                const pending = pendingCounts[item.productId];
                const displayActual = pending !== undefined ? pending : item.actualQuantity;
                const computedDisc = displayActual !== null ? displayActual - item.systemQuantity : null;
                const isDirty = pending !== undefined && pending !== item.actualQuantity;

                return (
                  <tr key={item.id} className={cn('hover:bg-slate-50/50 transition-colors', isDirty && 'bg-indigo-50/30')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 leading-snug">{item.productName}</p>
                      {item.isbnBarcode && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <ScanLine className="w-3 h-3" />{item.isbnBarcode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-700 text-base">{item.systemQuantity}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          className={cn(
                            'w-24 text-center font-bold text-base border rounded-xl py-1.5 px-2 outline-none transition-all',
                            isDirty
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'
                          )}
                          value={displayActual ?? ''}
                          placeholder="—"
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                            if (val === undefined) {
                              setPendingCounts(prev => { const n = { ...prev }; delete n[item.productId]; return n; });
                            } else {
                              setPendingCounts(prev => ({ ...prev, [item.productId]: val }));
                            }
                          }}
                        />
                      ) : (
                        <span className={cn(
                          'font-bold text-base',
                          displayActual === null ? 'text-slate-300' : 'text-slate-800'
                        )}>
                          {displayActual ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DiscrepancyBadge value={computedDisc} />
                    </td>
                    {st.status === 'DRAFT' && (
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => { if(window.confirm('Xóa sản phẩm này khỏi phiếu?')) mutRemoveProduct.mutate(item.productId); }}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-wrap items-center gap-3 justify-between rounded-b-3xl">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportDetail} 
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Xuất Excel
          </button>

          {canCancel && !showCancelInput && (
            <button onClick={() => setShowCancelInput(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
              <XCircle className="w-4 h-4" />Hủy phiếu
            </button>
          )}
          {showCancelInput && (
            <div className="flex items-center gap-2">
              <input
                className="px-3 py-2 text-sm border border-red-200 rounded-xl w-56 outline-none focus:ring-2 focus:ring-red-500/20"
                placeholder="Lý do hủy..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
              <button
                onClick={() => mutCancel.mutate()}
                disabled={!cancelReason.trim() || mutCancel.isPending}
                className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {mutCancel.isPending ? <Spinner size="sm" className="text-white" /> : 'Xác nhận'}
              </button>
              <button onClick={() => setShowCancelInput(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canStart && (
            <button
              onClick={() => mutStart.mutate()}
              disabled={mutStart.isPending || st.items.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              {mutStart.isPending ? <Spinner size="sm" className="text-white" /> : <PlayCircle className="w-4 h-4" />}
              Bắt đầu đếm
            </button>
          )}
          {canFinish && (
            <button
              onClick={handleComplete}
              disabled={mutComplete.isPending || mutSave.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 shadow-sm transition-colors"
            >
              {(mutComplete.isPending || mutSave.isPending) ? <Spinner size="sm" className="text-white" /> : <CheckCheck className="w-4 h-4" />}
              Hoàn thành đếm
            </button>
          )}
          {canApprove && !showApproveConfirm && (
            <button
              onClick={() => setShowApproveConfirm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Duyệt & Điều chỉnh kho
            </button>
          )}
          {showApproveConfirm && (
            <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
              <div>
                <p className="text-xs font-bold text-emerald-800 mb-1.5">
                  {st.discrepancyItems > 0
                    ? `⚠ Sẽ điều chỉnh ${st.discrepancyItems} sản phẩm trong kho`
                    : '✓ Không có chênh lệch — Không có gì thay đổi'}
                </p>
                <input
                  className="px-2 py-1.5 text-xs border border-emerald-200 rounded-lg w-52 outline-none"
                  placeholder="Ghi chú duyệt (tuỳ chọn)"
                  value={approveNote}
                  onChange={e => setApproveNote(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => mutApprove.mutate()}
                  disabled={mutApprove.isPending}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {mutApprove.isPending ? <Spinner size="sm" className="text-white" /> : 'Xác nhận duyệt'}
                </button>
                <button onClick={() => setShowApproveConfirm(false)} className="px-4 py-1.5 text-emerald-700 hover:underline text-xs font-medium">
                  Hủy bỏ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE MODAL
// ─────────────────────────────────────────────────────────────
function CreateStockTakeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();
  const [note, setNote] = useState('');
  const [countAll, setCountAll] = useState(true); 
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-st'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
    enabled: isAdmin(),
  });

  const [warehouseId, setWarehouseId] = useState(isAdmin() ? '' : (user?.warehouseId ?? ''));

  const mut = useMutation({
    mutationFn: () => stockTakeService.create({
      warehouseId: isAdmin() ? warehouseId : undefined,
      productIds:  countAll ? undefined : selectedProducts.map(p => p.value),
      note: note || undefined,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['stock-takes'] });
      toast.success(`Đã tạo phiếu kiểm kê #${r.data.data.code}`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo phiếu'),
  });

  return (
    <ModalShell onClose={onClose} title="Tạo phiếu kiểm kê mới">
      <div className="p-6 space-y-5">
        {isAdmin() && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chi nhánh <span className="text-red-500">*</span></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white font-semibold text-slate-700 appearance-none"
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
              >
                <option value="">-- Chọn chi nhánh --</option>
                {(warehouses ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phạm vi kiểm kê</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ borderColor: countAll ? '#6366f1' : '#e2e8f0', background: countAll ? '#eef2ff' : undefined }}>
              <input type="radio" checked={countAll} onChange={() => setCountAll(true)} className="accent-indigo-600 w-4 h-4" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Kiểm kê toàn bộ kho</p>
                <p className="text-xs text-slate-500">Tất cả sản phẩm hiện có trong kho sẽ được đưa vào phiếu</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ borderColor: !countAll ? '#6366f1' : '#e2e8f0', background: !countAll ? '#eef2ff' : undefined }}>
              <input type="radio" checked={!countAll} onChange={() => setCountAll(false)} className="accent-indigo-600 w-4 h-4" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Kiểm kê chọn lọc (Một phần)</p>
                <p className="text-xs text-slate-500">Chỉ kiểm kê một số mặt hàng cụ thể do bạn chọn</p>
              </div>
            </label>

            {!countAll && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn sản phẩm cần kiểm kê</label>
                <AsyncSelect 
                  isMulti
                  cacheOptions 
                  defaultOptions // ĐÃ THÊM
                  loadOptions={loadProductOptions} 
                  value={selectedProducts}
                  onChange={(opts) => setSelectedProducts(opts as any[])}
                  placeholder="Gõ tên hoặc mã vạch để tìm..."
                  className="text-sm font-medium"
                  noOptionsMessage={() => "Không tìm thấy sản phẩm"} // ĐÃ THÊM
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ghi chú</label>
          <textarea
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
            rows={3}
            placeholder="VD: Kiểm kê định kỳ tháng 6..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium">
            Mỗi chi nhánh chỉ được có 1 phiếu kiểm kê đang thực hiện. Hãy hoàn tất hoặc hủy phiếu cũ trước khi tạo mới.
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || (isAdmin() && !warehouseId) || (!countAll && selectedProducts.length === 0)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {mut.isPending ? <Spinner size="sm" className="text-white" /> : <Plus className="w-4 h-4" />}
          Tạo phiếu
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED MODAL SHELL
// ─────────────────────────────────────────────────────────────
function ModalShell({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className={cn(
        'bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden max-h-[90vh]',
        wide ? 'w-full max-w-5xl' : 'w-full max-w-lg'
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-xl text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            {title}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'IN_PROGRESS', label: 'Đang đếm' },
  { value: 'COMPLETED', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export default function StockTakePage() {
  const { user, isAdmin } = useAuthStore();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: isAdmin(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock-takes', isAdmin() ? selectedWarehouseId : user?.warehouseId, page],
    queryFn: () => stockTakeService.getAll({
      warehouseId: isAdmin() ? (selectedWarehouseId || undefined) : user?.warehouseId,
      page,
      size: PAGE_SIZE,
    }).then(r => r.data.data),
  });

  const filtered = useMemo(() => {
    if (!data?.content) return [];
    if (statusFilter === 'ALL') return data.content;
    return data.content.filter(st => st.status === statusFilter);
  }, [data, statusFilter]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await stockTakeService.getAll({
        warehouseId: isAdmin() ? (selectedWarehouseId || undefined) : user?.warehouseId,
        page: 0,
        size: 10000,
      });
      const allData = res.data.data.content;
      if (!allData || allData.length === 0) {
        toast.error('Không có dữ liệu để xuất');
        return;
      }
      const excelData = allData.map((st: any, index: number) => ({
        'STT': index + 1,
        'Mã Phiếu': st.code,
        'Chi Nhánh': st.warehouseName || '',
        'Trạng Thái': STATUS_CONFIG[st.status]?.label || st.status,
        'Tổng SP': st.totalItems,
        'Chênh lệch': st.discrepancyItems,
        'Người Tạo': st.createdByName || '',
        'Ngày Tạo': formatDate(st.createdAt),
        'Ghi Chú': st.note || ''
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachKiemKe");
      XLSX.writeFile(wb, `Danh_Sach_Kiem_Kho_${new Date().getTime()}.xlsx`);
      toast.success('Xuất Excel thành công!');
    } catch (e) {
      toast.error('Lỗi khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
            Kiểm kê tồn kho
          </h1>
          <p className="text-slate-500 text-sm mt-1">Tạo phiếu kiểm kê, đối chiếu số lượng thực tế với hệ thống</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || filtered.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 flex-1 sm:flex-none"
          >
            {isExporting ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            Xuất Excel
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            Tạo phiếu mới
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Tổng phiếu', value: data.totalElements, color: 'text-slate-700' },
            { label: 'Đang thực hiện', value: data.content.filter(s => s.status === 'IN_PROGRESS').length, color: 'text-blue-700' },
            { label: 'Chờ duyệt', value: data.content.filter(s => s.status === 'COMPLETED').length, color: 'text-amber-700' },
            { label: 'Đã duyệt', value: data.content.filter(s => s.status === 'APPROVED').length, color: 'text-emerald-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className={cn('text-3xl font-black mt-1', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isAdmin() && (
          <div className="relative w-full sm:w-64">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-8 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
            >
              <option value="">Toàn hệ thống</option>
              {warehouses?.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><PageLoader /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Chưa có phiếu kiểm kê nào"
            description="Tạo phiếu đầu tiên để bắt đầu kiểm kê tồn kho"
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã phiếu</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng SP</th>
                  <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Chênh lệch</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Người tạo</th>
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày tạo</th>
                  <th className="px-4 py-3.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(st => (
                  <tr
                    key={st.id}
                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(st.id)}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 font-mono text-sm">{st.code}</span>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={st.status} /></td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-semibold text-slate-700">{st.totalItems}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {st.discrepancyItems > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                          <AlertTriangle className="w-3 h-3" />{st.discrepancyItems} SP
                        </span>
                      ) : st.status === 'APPROVED' ? (
                        <span className="text-emerald-600 text-xs font-semibold">✓ Khớp</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">{st.createdByName ?? '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{formatDate(st.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  totalElements={data.totalElements}
                  size={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <CreateStockTakeModal onClose={() => setShowCreate(false)} />}
      {selectedId && <StockTakeDetailModal stockTakeId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}