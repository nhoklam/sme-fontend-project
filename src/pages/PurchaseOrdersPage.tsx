import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, CheckCircle, XCircle, Eye, Search, Filter, ClipboardList, ChevronDown, DollarSign } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
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

// --- CẤU HÌNH TOOLTIP CHO BIỂU ĐỒ ---
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[160px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            <span className="text-sm font-medium text-slate-500">Số lượng:</span>
          </div>
          <span className="text-sm font-black text-slate-900">{payload[0].value} phiếu</span>
        </div>
      </div>
    );
  }
  return null;
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
    warehouses?.forEach((w: any) => map.set(w.id, w.name));
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

  // --- TÍNH TOÁN DATA CHO MINI DASHBOARD ---
  const dashboardStats = useMemo(() => {
    const pos = data?.content || [];
    let totalValue = 0;
    const statusCount: Record<string, { count: number, color: string }> = {};

    pos.forEach((po: any) => {
      totalValue += Number(po.totalAmount || 0);
      const statusLabel = STATUS_LABELS[po.status] || po.status;
      
      if (!statusCount[statusLabel]) {
        let color = '#94a3b8'; // DRAFT (Gray)
        if (po.status === 'PENDING') color = '#f59e0b'; // Amber
        if (po.status === 'COMPLETED') color = '#10b981'; // Emerald
        if (po.status === 'CANCELLED') color = '#f43f5e'; // Rose
        statusCount[statusLabel] = { count: 0, color };
      }
      statusCount[statusLabel].count++;
    });

    const chartData = Object.entries(statusCount).map(([name, val]) => ({
      name, value: val.count, color: val.color
    }));

    return { totalValue, chartData };
  }, [data?.content]);

  if (isLoading && page === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Nhập kho</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi và tạo mới các phiếu nhập hàng từ Nhà cung cấp.</p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all"
        >
          <Plus className="w-5 h-5" /> Tạo phiếu nhập
        </button>
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Card 1: Tổng số phiếu */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng phiếu trang này</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{data?.content?.length || 0} <span className="text-sm font-bold text-slate-400">/ {data?.totalElements || 0}</span></h3>
            </div>
          </div>
          <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Giá trị nhập</span>
             <span className="font-black text-indigo-600 text-base">{formatCurrency(dashboardStats.totalValue)}</span>
          </div>
        </div>

        {/* Card 2: Biểu đồ trạng thái */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-8">
          <div className="w-1/3 h-[120px] relative shrink-0">
            {dashboardStats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardStats.chartData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardStats.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu trạng thái (Trang này)</p>
            <div className="space-y-3">
              {dashboardStats.chartData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{d.value} <span className="text-xs font-medium text-slate-400 ml-1">phiếu</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC BẢNG DỮ LIỆU & BỘ LỌC ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm theo mã phiếu, ghi chú..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative w-full sm:w-56 shrink-0 group">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={statusFilter} 
                 onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
               >
                 <option value="ALL">Tất cả trạng thái</option>
                 <option value="DRAFT">Nháp</option>
                 <option value="PENDING">Chờ duyệt</option>
                 <option value="COMPLETED">Đã nhập kho</option>
                 <option value="CANCELLED">Đã hủy</option>
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {isRefetching && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          )}
          
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Mã phiếu</th>
                <th className="px-6 py-5">Nhà cung cấp</th>
                <th className="px-6 py-5">Nhập tại chi nhánh</th>
                <th className="px-6 py-5 text-right">Tổng tiền</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5">Ngày tạo</th>
                <th className="px-6 py-5 text-right w-36">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(data?.content ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24">
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
                    <td className="px-6 py-4">
                      <button onClick={() => setViewingPoId(po.id)} className="font-mono font-bold text-[14px] text-indigo-600 hover:text-indigo-800 transition-colors block text-left">
                        {po.code}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 truncate max-w-[200px]" title={supplierMap.get(po.supplierId) || po.supplierId}>
                        {supplierMap.get(po.supplierId) || <span className="text-slate-400 font-mono text-[11px]">{po.supplierId.slice(0,8)}...</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-lg text-xs font-semibold inline-block">
                        {warehouseMap.get(po.warehouseId) || <span className="text-slate-400 font-mono text-[10px]">{po.warehouseId.slice(0,8)}...</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black tracking-tight text-right text-slate-900 text-base">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${getPurchaseStatusColor(po.status).replace('bg-','bg-').replace('text-','text-').replace('border-','border-')}`}>
                        {STATUS_LABELS[po.status] || po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(po.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-1.5 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        
                        {/* Nút Xem chi tiết */}
                        <button 
                          onClick={() => setViewingPoId(po.id)} 
                          className="p-1.5 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors" 
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Nút Duyệt phiếu */}
                        {po.status === 'PENDING' && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button 
                            onClick={() => setConfirmApprove(po.id)} 
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-100/50 hover:bg-emerald-100 shadow-sm shrink-0" 
                            title="Duyệt phiếu (Nhập kho)"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Duyệt
                          </button>
                        )}
                        
                        {/* Nút Hủy phiếu */}
                        {(po.status === 'DRAFT' || po.status === 'PENDING') && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button 
                            onClick={() => setCancelPoId(po.id)} 
                            className="p-1.5 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors shrink-0" 
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Hủy Phiếu Nhập Kho</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Phiếu này sẽ bị hủy bỏ và không thể phục hồi.</p>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-slate-50/30">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lý do hủy (Bắt buộc) <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 block p-4 transition-colors outline-none resize-none shadow-sm custom-scrollbar" 
                rows={4} 
                placeholder="Ví dụ: NCC báo hết hàng, sai giá nhập, nhầm số lượng..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setCancelPoId(null); setCancelReason(''); }} 
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCancelSubmit} 
                disabled={cancelMut.isPending || !cancelReason.trim()} 
                className="flex items-center justify-center min-w-[140px] px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(225,29,72,0.3)] hover:bg-rose-700 disabled:opacity-50 disabled:shadow-none transition-all"
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