import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, CheckCircle, XCircle, Eye, X } from 'lucide-react';
import { purchaseService } from '@/services/purchase.service';
import { supplierService } from '@/services/supplier.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getPurchaseStatusColor } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner, ConfirmDialog } from '@/components/ui';
import toast from 'react-hot-toast';

// Nhập 2 Modal chúng ta vừa tạo ở Bước 1 và 2
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { PurchaseOrderDetailsModal } from './PurchaseOrderDetailsModal';

export default function PurchaseOrdersPage() {
  const { warehouseId, isAdmin } = useAuthStore();
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  // --- CÁC STATE QUẢN LÝ MODAL ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPoId, setViewingPoId] = useState<string | null>(null);
  
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);
  const [cancelPoId, setCancelPoId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // --- GỌI API LẤY DỮ LIỆU ---
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page],
    queryFn: () => purchaseService.getAll({ page, size: 20 }).then(r => r.data.data),
  });

  // Tải danh sách Nhà cung cấp để hiển thị tên
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll().then(r => r.data.data.content),
  });

  // Tải danh sách Chi nhánh để hiển thị tên
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  // Tạo Map() để tra cứu nhanh Tên từ UUID
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

  // --- MUTATIONS (HÀNH ĐỘNG) ---
  const approveMut = useMutation({
    mutationFn: (id: string) => purchaseService.approve(id),
    onSuccess: () => { 
      toast.success('Duyệt phiếu nhập thành công! Tồn kho đã được cập nhật.'); 
      qc.invalidateQueries({ queryKey: ['purchase-orders'] }); 
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Phiếu nhập kho</h2>
          <p className="text-sm text-gray-500">Quản lý nhập hàng từ Nhà cung cấp</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Tạo phiếu nhập
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Nhà cung cấp</th>
                <th>Nhập tại chi nhánh</th>
                <th className="text-right">Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {(data?.content ?? []).length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Package} title="Chưa có phiếu nhập kho" description="Hãy tạo phiếu mới để nhập hàng vào kho" /></td></tr>
              ) : (
                (data?.content ?? []).map(po => (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                    <td>
                      <button onClick={() => setViewingPoId(po.id)} className="font-mono font-bold text-primary-600 hover:underline">
                        {po.code}
                      </button>
                    </td>
                    <td>
                      <p className="font-medium text-gray-800 truncate max-w-[200px]" title={supplierMap.get(po.supplierId) || po.supplierId}>
                        {supplierMap.get(po.supplierId) || <span className="text-gray-400 font-mono text-xs">{po.supplierId.slice(0,8)}...</span>}
                      </p>
                    </td>
                    <td>
                      <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg text-sm font-medium">
                        {warehouseMap.get(po.warehouseId) || <span className="text-gray-400 font-mono text-xs">{po.warehouseId.slice(0,8)}...</span>}
                      </span>
                    </td>
                    <td className="font-bold text-right text-gray-900">{formatCurrency(po.totalAmount)}</td>
                    <td>
                      <span className={`badge ${getPurchaseStatusColor(po.status)}`}>{po.status}</span>
                    </td>
                    <td className="text-gray-500 text-sm">{formatDateTime(po.createdAt)}</td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setViewingPoId(po.id)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Xem chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {po.status === 'PENDING' && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button onClick={() => setConfirmApprove(po.id)} className="btn-success btn-sm text-xs px-2" title="Duyệt phiếu (Nhập kho)">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Duyệt
                          </button>
                        )}
                        
                        {(po.status === 'DRAFT' || po.status === 'PENDING') && (isAdmin() || warehouseId() === po.warehouseId) && (
                          <button onClick={() => setCancelPoId(po.id)} className="btn-danger btn-sm text-xs px-2" title="Hủy phiếu">
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Hủy
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
        {data && data.totalPages > 1 && (
          <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} />
        )}
      </div>

      {/* --- RENDER CÁC MODAL --- */}
      
      <ConfirmDialog
        open={!!confirmApprove}
        title="Duyệt phiếu nhập kho"
        description="Sau khi duyệt, hàng sẽ được cộng vào kho ngay lập tức, giá vốn MAC sẽ được tính lại và phát sinh công nợ với Nhà cung cấp. Bạn có chắc chắn không thể hoàn tác?"
        onConfirm={() => approveMut.mutate(confirmApprove!)}
        onCancel={() => setConfirmApprove(null)}
        loading={approveMut.isPending}
      />

      {/* Dialog Nhập lý do Hủy phiếu (Thay vì hardcode) */}
      {cancelPoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-slide-up">
            <div className="p-5 border-b">
              <h3 className="font-bold text-lg text-gray-800">Hủy Phiếu Nhập Kho</h3>
              <p className="text-sm text-gray-500 mt-1">Phiếu này sẽ bị hủy bỏ và không thể phục hồi.</p>
            </div>
            <div className="p-5">
              <label className="label">Lý do hủy (Bắt buộc) <span className="text-red-500">*</span></label>
              <textarea 
                className="input resize-none" 
                rows={3} 
                placeholder="Ví dụ: NCC báo hết hàng, sai giá nhập..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => { setCancelPoId(null); setCancelReason(''); }} 
                className="btn-secondary"
              >
                Đóng
              </button>
              <button 
                onClick={handleCancelSubmit} 
                disabled={cancelMut.isPending || !cancelReason.trim()}
                className="btn-danger"
              >
                {cancelMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreatePurchaseOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['purchase-orders'] })}
        />
      )}

      {viewingPoId && (
        <PurchaseOrderDetailsModal
          purchaseOrderId={viewingPoId}
          onClose={() => setViewingPoId(null)}
        />
      )}
    </div>
  );
}