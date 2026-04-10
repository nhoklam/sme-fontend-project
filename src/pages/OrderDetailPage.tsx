import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, CreditCard, Package, Clock, Truck, Store, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { orderService } from '@/services/order.service';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // ĐÃ BỔ SUNG: State cho Modal Hoàn trả
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const { data: order, isLoading, isRefetching } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getById(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (body: { status: string; note?: string; trackingCode?: string; shippingProvider?: string }) =>
      orderService.updateStatus(id!, body),
    onSuccess: async () => { 
      toast.success('Cập nhật thành công'); 
      await qc.invalidateQueries({ queryKey: ['order', id] }); 
      setShowShippingModal(false);
      setShowCancelModal(false);
      setShowReturnModal(false); // Reset Modal Hoàn trả
      setCancelReason('');
      setReturnReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi'),
  });

  if (isLoading || !order) return <PageLoader />;

  const nextActions: Record<string, { label: string; status: string; color: string; icon: React.ElementType }> = {
    PENDING:  { label: 'Chuyển sang Đóng gói', status: 'PACKING',   color: 'btn-primary', icon: Package },
    PACKING:  { label: 'Chuyển sang Đang giao', status: 'SHIPPING',  color: 'btn-primary', icon: Truck },
    SHIPPING: { label: 'Xác nhận Đã giao',      status: 'DELIVERED', color: 'btn-success', icon: CheckCircle },
    DELIVERED: { label: 'Hoàn trả đơn hàng',     status: 'RETURNED',  color: 'btn-danger',  icon: RotateCcw }
  };

  const next = nextActions[order.status];

  const handleNextAction = () => {
    if (next.status === 'SHIPPING' && order.type !== 'BOPIS') {
      setShippingProvider(order.shippingProvider || '');
      setTrackingCode(order.trackingCode || '');
      setShowShippingModal(true);
    } else if (next.status === 'RETURNED') {
      // ĐÃ BỔ SUNG: Gọi Modal thay vì mutate trực tiếp
      setShowReturnModal(true);
    } else {
      updateMut.mutate({ status: next.status });
    }
  };

  const handleConfirmShipping = () => {
    updateMut.mutate({
      status: 'SHIPPING',
      shippingProvider: shippingProvider,
      trackingCode: trackingCode
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy đơn');
      return;
    }
    updateMut.mutate({ status: 'CANCELLED', note: cancelReason });
  };

  // ĐÃ BỔ SUNG: Hàm xử lý Xác nhận Hoàn trả
  const handleConfirmReturn = () => {
    if (!returnReason.trim()) {
      toast.error('Vui lòng nhập lý do hoàn trả');
      return;
    }
    updateMut.mutate({ status: 'RETURNED', note: `Lý do hoàn trả: ${returnReason}` });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-xl text-gray-800">Đơn hàng {order.code}</h2>
        <span className={`badge ${getOrderStatusColor(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
        
        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${order.type === 'BOPIS' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
          {order.type === 'BOPIS' ? 'Nhận tại quầy' : 'Giao tận nơi'}
        </span>

        <div className="ml-auto flex gap-2">
          {next && (
            <button onClick={handleNextAction} disabled={updateMut.isPending || isRefetching}
              className={next.color + ' btn flex items-center gap-2'}>
              {updateMut.isPending ? <Spinner size="sm" className="text-white"/> : <><next.icon className="w-4 h-4" /> {next.label}</>}
            </button>
          )}
          {(order.status === 'PENDING' || order.status === 'PACKING') && (
            <button onClick={() => setShowCancelModal(true)} disabled={updateMut.isPending || isRefetching} className="btn-danger flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 border-none">
              <XCircle className="w-4 h-4" /> Hủy đơn
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer & shipping */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" />Thông tin giao hàng</h3></div>
          <div className="card-body space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Người nhận</span><span className="font-medium text-gray-800">{order.shippingName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">SĐT</span><span className="font-mono">{order.shippingPhone}</span></div>
            
            {order.type === 'DELIVERY' ? (
              <>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 whitespace-nowrap">Địa chỉ</span>
                  <span className="text-right text-gray-700">{order.shippingAddress}</span>
                </div>
                {order.shippingProvider && (
                  <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-500">Đơn vị vận chuyển</span>
                    <span className="font-medium">{order.shippingProvider}</span>
                  </div>
                )}
                {order.trackingCode && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mã vận đơn</span>
                    <span className="font-mono font-bold text-primary-600">{order.trackingCode}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg text-center">
                <p className="text-purple-800 font-medium">Khách hàng sẽ đến lấy tại quầy</p>
                <p className="text-purple-600 text-xs mt-1">Chi nhánh: {order.assignedWarehouseName}</p>
              </div>
            )}
            
            {/* ĐÃ BỔ SUNG: Hiển thị thông tin người đóng gói (nếu có) */}
            {order.packedAt && (
              <div className="flex justify-between border-t border-gray-100 pt-3 mt-2">
                <span className="text-gray-500">Đóng gói bởi</span>
                <div className="text-right">
                  <span className="font-medium text-gray-800 block">{order.packedBy}</span>
                  <span className="text-gray-400 text-xs">{formatDateTime(order.packedAt)}</span>
                </div>
              </div>
            )}
            
            {order.status === 'CANCELLED' && order.cancelledReason && (
               <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-red-800 text-sm">
                 <span className="font-bold">Lý do hủy:</span> {order.cancelledReason}
               </div>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-500" />Thanh toán</h3></div>
          <div className="card-body space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Phương thức</span><span className="font-medium">{order.paymentMethod}</span></div>
            <div className="flex justify-between items-center"><span className="text-gray-500">Trạng thái TT</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                  {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa TT'}
                </span>
                {order.paymentMethod === 'COD' && order.codReconciled && (
                   <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">Đã đối soát</span>
                )}
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-3 mt-1 space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Tổng sản phẩm</span><span>{formatCurrency(order.totalAmount)}</span></div>
              {order.type === 'DELIVERY' && (
                <div className="flex justify-between"><span className="text-gray-500">Phí ship</span><span>{formatCurrency(order.shippingFee)}</span></div>
              )}
            </div>
            
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3 mt-1">
              <span>Tổng thanh toán</span><span className="text-primary-600">{formatCurrency(order.finalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-orange-500" />Sản phẩm ({order.items.length})</h3></div>
        <div className="table-wrapper border-0 border-t border-gray-100 rounded-none">
          <table className="table">
            <thead className="bg-gray-50"><tr><th>Sản phẩm</th><th>Mã vạch</th><th className="text-center">Số lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th></tr></thead>
            <tbody>
              {order.items.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="font-medium text-gray-800">{item.productName ?? item.productId}</td>
                  <td className="font-mono text-gray-500 text-xs">{item.isbnBarcode ?? '-'}</td>
                  <td className="text-center font-semibold text-gray-700">{item.quantity}</td>
                  <td className="text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="font-bold text-right text-gray-900">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status history */}
      {(order.statusHistory ?? []).length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" />Lịch sử trạng thái</h3></div>
          <div className="card-body space-y-4">
            {order.statusHistory!.map((h: any, i: number) => (
              <div key={i} className="flex items-start gap-4 text-sm relative">
                {i !== order.statusHistory!.length - 1 && (
                  <div className="absolute left-1.5 top-5 bottom-[-20px] w-0.5 bg-gray-100" />
                )}
                <div className="w-3 h-3 bg-primary-500 rounded-full mt-1 flex-shrink-0 z-10 ring-4 ring-white" />
                <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-800">{getOrderStatusLabel(h.newStatus)}</span>
                    <span className="text-gray-400 text-xs">{formatDateTime(h.createdAt)}</span>
                  </div>
                  {h.note && <div className="text-gray-600 italic text-sm mt-1">{h.note}</div>}
                  <div className="text-gray-400 text-xs mt-2 font-medium flex items-center gap-1">
                    Người thực hiện: <span className="text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">{h.changedBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL NHẬP THÔNG TIN GIAO HÀNG */}
      {showShippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-slide-up">
            <div className="p-5 border-b flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-lg text-gray-800">Thông tin vận chuyển</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">Vui lòng nhập thông tin vận chuyển trước khi chuyển đơn hàng sang trạng thái "Đang giao".</p>
              
              <div>
                <label className="label">Đơn vị vận chuyển</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="VD: GHTK, Viettel Post, Grab..." 
                  value={shippingProvider} 
                  onChange={e => setShippingProvider(e.target.value)} 
                  autoFocus
                />
              </div>
              
              <div>
                <label className="label">Mã vận đơn (Tracking Code)</label>
                <input 
                  type="text" 
                  className="input font-mono" 
                  placeholder="Nhập mã vận đơn..." 
                  value={trackingCode} 
                  onChange={e => setTrackingCode(e.target.value)} 
                />
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowShippingModal(false)} className="btn-secondary">Hủy</button>
              <button 
                onClick={handleConfirmShipping} 
                disabled={updateMut.isPending}
                className="btn-primary"
              >
                Xác nhận Giao hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NHẬP LÝ DO HỦY ĐƠN */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-slide-up">
            <div className="p-5 border-b">
              <h3 className="font-bold text-lg text-red-600">Hủy đơn hàng</h3>
              <p className="text-sm text-gray-500 mt-1">Lưu ý: Hành động này không thể hoàn tác.</p>
            </div>
            <div className="p-5">
              <label className="label">Lý do hủy đơn <span className="text-red-500">*</span></label>
              <textarea 
                className="input resize-none" 
                rows={3} 
                placeholder="VD: Khách đổi ý, Hết hàng, Không liên lạc được..." 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                autoFocus
              />
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary">Đóng</button>
              <button 
                onClick={handleConfirmCancel} 
                disabled={updateMut.isPending || !cancelReason.trim()}
                className="btn-danger"
              >
                Xác nhận Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ĐÃ BỔ SUNG: MODAL NHẬP LÝ DO HOÀN TRẢ */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-slide-up">
            <div className="p-5 border-b flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-lg text-red-600">Hoàn trả đơn hàng</h3>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-gray-500 mb-2">Hàng hóa sẽ được hoàn lại vào kho. Vui lòng ghi rõ lý do trả hàng để đối soát sau này.</p>
              <label className="label">Lý do hoàn trả <span className="text-red-500">*</span></label>
              <textarea 
                className="input resize-none" 
                rows={3} 
                placeholder="VD: Hàng lỗi, Khách không nhận, Đóng gói sai..." 
                value={returnReason} 
                onChange={e => setReturnReason(e.target.value)} 
                autoFocus
              />
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setShowReturnModal(false)} className="btn-secondary">Đóng</button>
              <button 
                onClick={handleConfirmReturn} 
                disabled={updateMut.isPending || !returnReason.trim()}
                className="btn-danger flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Xác nhận Hoàn trả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}