import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Package, Search, RefreshCw, Eye, MapPin, Store, Truck, Plus, 
  CheckCircle, Filter, ShoppingBag, ArrowRight
} from 'lucide-react';
import { orderService } from '@/services/order.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { CreateOrderModal } from './CreateOrderModal'; 

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING',   label: 'Chờ xử lý' },
  { value: 'PACKING',   label: 'Đang đóng gói' },
  { value: 'SHIPPING',  label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'RETURNED',  label: 'Hoàn trả' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả loại đơn' },
  { value: 'DELIVERY', label: 'Giao tận nơi' },
  { value: 'BOPIS',    label: 'Khách nhận tại quầy' },
];

export default function OrdersPage() {
  const { user, isAdmin, isManager } = useAuthStore();
  
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); 
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // State Quản lý Modal Đánh chặn Shipping
  const [shippingOrder, setShippingOrder] = useState<any | null>(null);
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

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

  const { data: pagedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', status, typeFilter, page, warehouseId, debouncedKeyword],
    queryFn: async () => {
      const res = await orderService.getOrders({ 
        status: status || undefined, 
        type: typeFilter || undefined, 
        keyword: debouncedKeyword || undefined, 
        page, 
        size: 20,
        warehouseId: isAdmin() ? (warehouseId || undefined) : user?.warehouseId
      });
      return res.data.data; 
    }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      orderService.updateStatus(id, body),
    onSuccess: async () => { 
      toast.success('Cập nhật trạng thái thành công'); 
      await qc.invalidateQueries({ queryKey: ['orders'] }); 
      setShippingOrder(null); 
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Lỗi cập nhật'),
  });

  const nextStatus: Record<string, string> = {
    PENDING: 'PACKING', 
    PACKING: 'SHIPPING', 
    SHIPPING: 'DELIVERED',
    DELIVERED: 'RETURNED'
  };

  const handleQuickUpdate = (order: any) => {
    const nextStatusStr = nextStatus[order.status];
    
    // Đánh chặn: Nếu là Đơn giao hàng (DELIVERY) & Cần chuyển từ Đóng gói -> Đang giao
    if (order.status === 'PACKING' && order.type === 'DELIVERY') {
      setShippingProvider('');
      setTrackingCode('');
      setShippingOrder(order); 
      return;
    }
    
    updateMut.mutate({ id: order.id, body: { status: nextStatusStr } });
  };

  const handleConfirmShippingModal = () => {
    if (!shippingOrder) return;
    updateMut.mutate({ 
      id: shippingOrder.id, 
      body: { 
        status: 'SHIPPING', 
        shippingProvider, 
        trackingCode 
      } 
    });
  };

  const displayList = pagedData?.content ?? [];

  if (isLoading && !displayList.length) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-600" /> Quản lý Đơn hàng
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi, xử lý và tạo mới các đơn hàng đa kênh</p>
        </div>
        
        <div className="flex w-full sm:w-auto">
          {(isAdmin() || isManager()) && (
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5 mr-1.5" /> Tạo đơn Telesale
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
        {/* Nhóm Search */}
        <div className="relative w-full xl:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium"
            placeholder="Tìm mã đơn, SĐT khách hàng..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>

        {/* Nhóm Select Filters */}
        <div className="flex gap-3 flex-wrap flex-1">
          <div className="relative flex-1 sm:flex-none min-w-[160px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <select 
               className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-9 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
               value={status} 
               onChange={e => { setStatus(e.target.value); setPage(0); }}
             >
               {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
             </select>
          </div>
          
          <div className="relative flex-1 sm:flex-none min-w-[180px]">
             <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
             <select 
               className="w-full bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-9 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
               value={typeFilter} 
               onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
             >
               {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
             </select>
          </div>
        </div>

        {/* Nhóm Chi nhánh & Nút Refresh */}
        <div className="flex items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
          {isAdmin() && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-w-[220px] transition-colors focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 flex-1 sm:flex-none">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setPage(0); }}
                className="bg-transparent border-none outline-none text-sm font-medium w-full cursor-pointer focus:ring-0 p-0 text-slate-700"
              >
                <option value="">Toàn hệ thống (Tất cả kho)</option>
                {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <button 
            onClick={() => refetch()} 
            disabled={isRefetching} 
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors shrink-0 outline-none" 
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[1050px]">
            <thead className="text-xs text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Mã đơn & Loại</th>
                <th className="px-5 py-4">Khách hàng</th>
                <th className="px-5 py-4">Kho xử lý</th>
                <th className="px-5 py-4 text-right">Tổng tiền</th>
                <th className="px-5 py-4 text-center">Thanh toán</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4">Ngày đặt</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <EmptyState 
                      icon={Package} 
                      title="Không có đơn hàng nào" 
                      description="Chưa có đơn hàng nào phù hợp với bộ lọc." 
                    />
                  </td>
                </tr>
              ) : (
                displayList.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <Link to={`/orders/${order.id}`} className="font-mono text-indigo-600 hover:text-indigo-800 font-bold text-[13px] block mb-1.5 transition-colors">
                        {order.code}
                      </Link>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.type === 'BOPIS' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {order.type === 'BOPIS' ? <><Store className="w-3 h-3"/> Nhận tại quầy</> : <><Truck className="w-3 h-3"/> Giao hàng</>}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">{order.customerName ?? 'Khách lẻ'}</div>
                      <div className="text-slate-500 font-medium text-xs mt-0.5">{order.shippingPhone || order.customerPhone}</div>
                    </td>
                    
                    <td className="px-5 py-4">
                      {order.assignedWarehouseName ? (
                        <span className="text-slate-600 font-semibold">{order.assignedWarehouseName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100 text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> Chờ gán kho
                        </span>
                      )}
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="font-black text-slate-900 tracking-tight text-[15px]">
                        {formatCurrency(order.finalAmount)}
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">{order.paymentMethod}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.paymentStatus === 'PAID' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {order.paymentStatus === 'PAID' ? 'Đã TT' : 'Chưa TT'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-lg border shadow-sm ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      {order.paymentMethod === 'COD' && order.codReconciled && (
                         <div className="mt-1.5">
                           <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                             Đã đối soát
                           </span>
                         </div>
                      )}
                    </td>
                    
                    <td className="px-5 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end items-center opacity-90 group-hover:opacity-100 transition-opacity">
                        {/* ĐỔI VỊ TRÍ: Đưa nút Cập nhật trạng thái lên trước */}
                        {nextStatus[order.status] && order.status !== 'WAITING_FOR_CONSOLIDATION' && (
                          <button 
                            onClick={() => handleQuickUpdate(order)} 
                            disabled={(updateMut.isPending && updateMut.variables?.id === order.id) || isRefetching}
                            // Thêm w-[110px] và justify-center để cố định kích thước nút
                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center w-[110px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed
                              ${order.status === 'DELIVERED' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent'
                              }`}
                            title="Cập nhật trạng thái nhanh"
                          >
                            {(updateMut.isPending && updateMut.variables?.id === order.id)
                              ? <Spinner size="sm" className={order.status === 'DELIVERED' ? "text-rose-600" : "text-white"} /> 
                              : nextStatus[order.status] === 'PACKING' ? 'Gói hàng' : 
                                nextStatus[order.status] === 'SHIPPING' ? 'Giao hàng' : 
                                nextStatus[order.status] === 'RETURNED' ? 'Hoàn trả' : 'Hoàn tất'
                            }
                            {!(updateMut.isPending && updateMut.variables?.id === order.id) && <ArrowRight className="w-3 h-3 ml-1 shrink-0" />}
                          </button>
                        )}

                        {/* ĐỔI VỊ TRÍ: Nút Mắt nằm cuối cùng, thêm shrink-0 */}
                        <Link 
                          to={`/orders/${order.id}`} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors shrink-0" 
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ── */}
        {pagedData && pagedData.totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <Pagination page={page} totalPages={pagedData.totalPages} totalElements={pagedData.totalElements} size={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── MODAL ĐÁNH CHẶN NHẬP VẬN ĐƠN TRƯỚC KHI GIAO HÀNG ── */}
      {shippingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Thông tin Vận chuyển</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Mã đơn: <span className="font-mono text-indigo-600 font-bold">{shippingOrder.code}</span></p>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm font-medium border border-blue-100">
                Vui lòng nhập thông tin Đơn vị vận chuyển trước khi chuyển đơn sang trạng thái Đang giao.
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Đơn vị vận chuyển</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" 
                    placeholder="VD: GHTK, Viettel Post, Shopee Express..." 
                    value={shippingProvider} 
                    onChange={e => setShippingProvider(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã vận đơn (Tracking Code)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-mono font-bold" 
                    placeholder="Nhập mã vận đơn..." 
                    value={trackingCode} 
                    onChange={e => setTrackingCode(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShippingOrder(null)} 
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmShippingModal} 
                disabled={updateMut.isPending} 
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[150px]"
              >
                {updateMut.isPending ? <Spinner size="sm"/> : 'Xác nhận Giao hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ORDER MODAL ── */}
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