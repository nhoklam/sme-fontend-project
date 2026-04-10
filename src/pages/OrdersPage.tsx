import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Search, RefreshCw, Eye, MapPin, Store, Truck, Plus, CheckCircle } from 'lucide-react';
import { orderService } from '@/services/order.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { CreateOrderModal } from './CreateOrderModal'; 

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING',   label: 'Chờ xử lý' },
  { value: 'PACKING',   label: 'Đang đóng gói' },
  { value: 'SHIPPING',  label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'RETURNED',  label: 'Hoàn trả' },
];

export default function OrdersPage() {
  const { user, isAdmin, isManager } = useAuthStore();
  
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const qc = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: isAdmin(),
  });

  // Query cho danh sách tất cả đơn (có phân trang & tìm kiếm phía Server)
  const { data: pagedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', status, page, warehouseId, debouncedKeyword],
    queryFn: async () => {
      const res = await orderService.getOrders({ 
        status: status || undefined, 
        keyword: debouncedKeyword || undefined, // Truyền trực tiếp keyword xuống Backend
        page, 
        size: 20,
        warehouseId: isAdmin() ? (warehouseId || undefined) : user?.warehouseId
      });
      return res.data.data; // Trả về nguyên gốc từ Backend
    }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      orderService.updateStatus(id, { status: newStatus }),
    onSuccess: async () => { 
      toast.success('Cập nhật trạng thái thành công'); 
      await qc.invalidateQueries({ queryKey: ['orders'] }); 
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Lỗi cập nhật'),
  });

  const nextStatus: Record<string, string> = {
    PENDING: 'PACKING', 
    PACKING: 'SHIPPING', 
    SHIPPING: 'DELIVERED',
    DELIVERED: 'RETURNED'
  };

  const displayList = pagedData?.content ?? [];

  if (isLoading && !displayList.length) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý Đơn hàng Online</h2>
          <p className="text-sm text-gray-500 mt-1">Theo dõi, xử lý và tạo mới các đơn hàng đa kênh</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(isAdmin() || isManager()) && (
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="btn-primary flex-1 sm:flex-none justify-center shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Tạo đơn (Telesale)
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-col xl:flex-row items-start xl:items-center gap-4">
        <div className="relative w-full xl:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Tìm mã đơn, SĐT..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 flex-wrap flex-1">
          {STATUS_OPTIONS.map(opt => (
            <button 
              key={opt.value} 
              onClick={() => { setStatus(opt.value); setPage(0); }}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                status === opt.value 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {isAdmin() && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 hover:border-primary-300 rounded-lg px-3 py-2 min-w-[220px] shadow-sm transition-colors focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 flex-1 sm:flex-none">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setPage(0); }}
                className="bg-transparent border-none outline-none text-sm w-full cursor-pointer focus:ring-0 p-0 text-gray-700"
              >
                <option value="">Toàn hệ thống (Tất cả kho)</option>
                {warehouses?.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => refetch()} 
            disabled={isRefetching}
            className="btn-secondary py-2 px-3 shrink-0" 
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-primary-500' : 'text-gray-500'}`} />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="py-4">Mã đơn & Loại</th>
                <th className="py-4">Khách hàng</th>
                <th className="py-4">Kho đóng gói</th>
                <th className="py-4 text-right">Tổng tiền</th>
                <th className="py-4 text-center">Thanh toán</th>
                <th className="py-4 text-center">Trạng thái</th>
                <th className="py-4">Ngày đặt</th>
                <th className="py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16">
                    <EmptyState 
                      icon={Package} 
                      title="Không có đơn hàng nào" 
                      description="Chưa có đơn hàng nào phù hợp với bộ lọc." 
                    />
                  </td>
                </tr>
              ) : (
                displayList.map((order: any) => (
                  <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="py-3">
                      <Link to={`/orders/${order.id}`} className="font-mono text-primary-600 hover:text-primary-700 hover:underline font-bold text-sm block">
                        {order.code}
                      </Link>
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          order.type === 'BOPIS' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {order.type === 'BOPIS' ? <><Store className="w-3 h-3"/> Tại quầy</> : <><Truck className="w-3 h-3"/> Giao hàng</>}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-3">
                      <div className="font-semibold text-gray-800 text-sm">{order.customerName ?? 'Khách lẻ'}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{order.shippingPhone || order.customerPhone}</div>
                    </td>
                    
                    <td className="py-3">
                      {order.assignedWarehouseName ? (
                        <span className="text-gray-600 text-sm font-medium">{order.assignedWarehouseName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" /> Chờ gán kho
                        </span>
                      )}
                    </td>
                    
                    <td className="py-3 font-bold text-gray-900 text-right text-sm">
                      {formatCurrency(order.finalAmount)}
                    </td>
                    
                    <td className="py-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-500">{order.paymentMethod}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.paymentStatus === 'PAID' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa TT'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-3 text-center">
                      <span className={`badge text-xs shadow-sm border border-black/5 ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      {order.paymentMethod === 'COD' && order.codReconciled && (
                         <div className="mt-1.5"><span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">Đã đối soát</span></div>
                      )}
                    </td>
                    
                    <td className="py-3 text-gray-500 text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                    
                    <td className="py-3">
                      <div className="flex gap-2 justify-end items-center opacity-80 group-hover:opacity-100 transition-opacity">
                        <Link 
                          to={`/orders/${order.id}`} 
                          className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" 
                          title="Xem chi tiết đơn hàng"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        
                        {nextStatus[order.status] && order.status !== 'PACKING' && (
                          <button 
                            onClick={() => updateMut.mutate({ id: order.id, newStatus: nextStatus[order.status] })}
                            disabled={(updateMut.isPending && updateMut.variables?.id === order.id) || isRefetching}
                            className={`btn-sm text-[11px] px-3 font-semibold shadow-sm ${order.status === 'DELIVERED' ? 'btn-danger' : 'btn-primary'}`} 
                            title="Cập nhật trạng thái nhanh"
                          >
                            {(updateMut.isPending && updateMut.variables?.id === order.id)
                              ? <Spinner size="sm" className="text-white" /> 
                              : nextStatus[order.status] === 'PACKING' ? 'Đóng gói' : 
                                nextStatus[order.status] === 'RETURNED' ? 'Hoàn trả' : 'Hoàn tất'
                            }
                          </button>
                        )}
                        
                        {order.status === 'PACKING' && (
                           <Link 
                           to={`/orders/${order.id}`} 
                           className="btn-primary btn-sm text-[11px] px-3 font-semibold shadow-sm" 
                           title="Vào chi tiết để nhập Mã vận đơn"
                         >
                           Giao hàng
                         </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagedData && pagedData.totalPages > 1 && (
          <div className="border-t border-gray-100 bg-gray-50/50">
            <Pagination 
              page={page} 
              totalPages={pagedData.totalPages} 
              totalElements={pagedData.totalElements} 
              size={20} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['report-summary'] });
          }}
        />
      )}
    </div>
  );
}