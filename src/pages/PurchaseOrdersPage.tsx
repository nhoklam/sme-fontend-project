import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, CheckCircle, XCircle, Eye, Search, Filter, ClipboardList } from 'lucide-react';
import { purchaseService } from '@/services/purchase.service';
import { supplierService } from '@/services/supplier.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getPurchaseStatusColor } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner, ConfirmDialog } from '@/components/ui';
import toast from 'react-hot-toast';

import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { PurchaseOrderDetailsModal } from './PurchaseOrderDetailsModal';

// Tiện ích map tiếng Việt cho trạng thái
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  COMPLETED: 'Đã nhập kho',
  CANCELLED: 'Đã hủy'
};

export default function PurchaseOrdersPage() {
  const { warehouseId, isAdmin } = useAuthStore();
  const qc = useQueryClient();
  
  const [page, setPage] = useState(0);
  
  // STATE TÌM KIẾM & LỌC
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPoId, setViewingPoId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);
  const [cancelPoId, setCancelPoId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Debounce tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Về trang 1 khi gõ tìm
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cập nhật Query gọi API kèm Filter
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['purchase-orders', page, debouncedSearch, statusFilter],
    queryFn: () => purchaseService.getAll({ 
      page, 
      size: 20, 
      keyword: debouncedSearch, 
      status: statusFilter === 'ALL' ? '' : statusFilter 
    }).then(r => r.data.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll().then(r => r.data.data.content),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers?.forEach((s: any) => map.set(s.id, s.name));
    return map;
  }, [suppliers]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouses?.forEach(w => map.set(w.id, w.name));
    return map;
  }, [warehouses]);

  const approveMut = useMutation({
    mutationFn: (id: string) => purchaseService.approve(id),
    onSuccess: () => { 
      toast.success('Duyệt phiếu nhập thành công! Tồn kho đã được cập nhật.'); 
      qc.invalidateQueries({ queryKey: ['purchase-orders'] }); 
      qc.invalidateQueries({ queryKey: ['inventory-search'] }); // Bổ sung làm mới kho
      setConfirmApprove(null); 
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi duyệt phiếu'),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => purchaseService.cancel(id, reason),
    onSuccess: () => { 
      toast.success('Đã hủy phiếu nhập kho'); 
      qc.invalidateQueries({ queryKey: ['purchase-orders'] }); 
      setCancelPoId(null);
      setCancelReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi hủy phiếu'),
  });

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy phiếu');
      return;
    }
    cancelMut.mutate({ id: cancelPoId!, reason: cancelReason });
  };

  if (isLoading && page === 0) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> Quản lý Nhập kho
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi và tạo mới các phiếu nhập hàng từ Nhà cung cấp</p>
        </div>

        <div className="flex w-full sm:w-auto">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Tạo phiếu nhập
          </button>
        </div>
      </div>

      {/* ── THANH TÌM KIẾM & LỌC ── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Tìm kiếm */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã phiếu, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium"
          />
        </div>

        {/* Lọc trạng thái */}
        <div className="relative w-full sm:w-56 shrink-0">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="COMPLETED">Đã nhập kho</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* ── BẢNG DỮ LIỆU ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative min-h-[300px]">
        {isRefetching && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}
        
        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Mã phiếu</th>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Nhập tại chi nhánh</th>
                <th className="px-5 py-4 text-right">Tổng tiền</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.content ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <EmptyState 
                      icon={Package} 
                      title="Chưa có phiếu nhập kho" 
                      description="Không có dữ liệu phù hợp với bộ lọc tìm kiếm của bạn." 
                    />
                  </td>
                </tr>
              ) : (
                (data?.content ?? []).map((po: any) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <button onClick={() => setViewingPoId(po.id)} className="font-mono font-bold text-[13px] text-indigo-600 hover:text-indigo-800 transition-colors block text-left">
                        {po.code}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 truncate max-w-[200px]" title={supplierMap.get(po.supplierId) || po.supplierId}>
                        {supplierMap.get(po.supplierId) || <span className="text-slate-400 font-mono text-[11px]">{po.supplierId.slice(0,8)}...</span>}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-block">
                        {warehouseMap.get(po.warehouseId) || <span className="text-slate-400 font-mono text-[10px]">{po.warehouseId.slice(0,8)}...</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black tracking-tight text-right text-slate-900 text-[15px]">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${getPurchaseStatusColor(po.status)}`}>
                        {STATUS_LABELS[po.status] || po.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(po.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end items-center opacity-90 group-hover:opacity-100 transition-opacity">
                        
                        {/* Nút Xem chi tiết */}
                        <button 
                          onClick={() => setViewingPoId(po.id)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors shrink-0" 
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Nút Duyệt phiếu */}
                        {po.status === 'PENDING' && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button 
                            onClick={() => setConfirmApprove(po.id)} 
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm shrink-0" 
                            title="Duyệt phiếu (Nhập kho)"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Duyệt
                          </button>
                        )}
                        
                        {/* Nút Hủy phiếu */}
                        {(po.status === 'DRAFT' || po.status === 'PENDING') && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button 
                            onClick={() => setCancelPoId(po.id)} 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition-colors shrink-0" 
                            title="Hủy phiếu"
                          >
                            <XCircle className="w-4 h-4" />
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
        
        {/* ── PHÂN TRANG ── */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── CONFIRM DIALOG DUYỆT ── */}
      <ConfirmDialog
        open={!!confirmApprove}
        title="Duyệt phiếu nhập kho"
        description="Sau khi duyệt, hàng sẽ được cộng vào kho ngay lập tức, giá vốn MAC sẽ được tính lại và phát sinh công nợ với Nhà cung cấp. Bạn có chắc chắn không thể hoàn tác?"
        onConfirm={() => approveMut.mutate(confirmApprove!)}
        onCancel={() => setConfirmApprove(null)}
        loading={approveMut.isPending}
      />

      {/* ── MODAL HỦY PHIẾU ── */}
      {cancelPoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
              <div className="p-2 bg-rose-100 rounded-lg">
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Hủy Phiếu Nhập Kho</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Phiếu này sẽ bị hủy bỏ và không thể phục hồi.</p>
              </div>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Lý do hủy (Bắt buộc) <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 block p-3 transition-colors outline-none resize-none" 
                rows={4} 
                placeholder="Ví dụ: NCC báo hết hàng, sai giá nhập, nhầm số lượng..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => { setCancelPoId(null); setCancelReason(''); }} 
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCancelSubmit} 
                disabled={cancelMut.isPending || !cancelReason.trim()} 
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[130px]"
              >
                {cancelMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <CreatePurchaseOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['purchase-orders'] })}
        />
      )}

      {/* ── DETAILS MODAL ── */}
      {viewingPoId && (
        <PurchaseOrderDetailsModal
          purchaseOrderId={viewingPoId}
          onClose={() => setViewingPoId(null)}
        />
      )}
    </div>
  );
}