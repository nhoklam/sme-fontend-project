import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ArrowLeft, MapPin, CreditCard, Package, Clock, Truck, Store, CheckCircle, XCircle, RotateCcw, Printer, User, ShieldAlert, ArrowRightLeft, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { orderService } from '@/services/order.service';
import { warehouseService } from '@/services/warehouse.service';
import { transferService } from '@/services/transfer.service'; // ĐÃ THÊM
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel, getErrorMessage } from '@/lib/utils';
import { PageLoader, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { OrderPrintTemplate } from './OrderPrintTemplate';

type NextAction = {
  label: string;
  action: 'confirm' | 'pack' | 'ship' | 'markReady' | 'complete' | 'return';
  className: string;
  icon: React.ElementType;
  needsShippingInfo?: boolean;
  needsReason?: boolean;
};

function getNextAction(order: { status: string; type: string }, role: string): NextAction | null {
  if (role === 'ROLE_CASHIER') {
    if (order.status === 'CONFIRMED') {
      return { label: 'Đóng gói ngay', action: 'pack', className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_12px_rgb(99,102,241,0.3)]', icon: Package };
    }
    return null; 
  }

  if (role === 'ROLE_MANAGER') {
    if (order.status === 'PENDING') {
      return { label: 'Xác nhận đơn', action: 'confirm', className: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-[0_4px_12px_rgb(8,145,178,0.3)]', icon: CheckCircle };
    }
    if (order.status === 'CONFIRMED') {
      return { label: 'Đóng gói ngay', action: 'pack', className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_12px_rgb(99,102,241,0.3)]', icon: Package };
    }
    if (order.status === 'PACKED') {
      return order.type === 'BOPIS'
        ? { label: 'Sẵn sàng lấy hàng', action: 'markReady', className: 'bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_12px_rgb(147,51,234,0.3)]', icon: Store }
        : { label: 'Giao cho ĐVVC', action: 'ship', className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_12px_rgb(99,102,241,0.3)]', icon: Truck, needsShippingInfo: true };
    }
    if (order.status === 'SHIPPING' || order.status === 'READY_FOR_PICKUP') {
      return { label: 'Xác nhận Đã giao', action: 'complete', className: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_4px_12px_rgb(5,150,105,0.3)]', icon: CheckCircle };
    }
    if (order.status === 'DELIVERED') {
      return { label: 'Xử lý Hoàn trả', action: 'return', className: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100', icon: RotateCcw, needsReason: true };
    }
    return null;
  }

  return null;
}

function canCancelOrder(order: { status: string }, role: string) {
  if (role === 'ROLE_CASHIER') return order.status === 'PENDING';
  if (role === 'ROLE_MANAGER') {
    return ['WAITING_FOR_CONSOLIDATION', 'PENDING', 'CONFIRMED', 'PACKED'].includes(order.status);
  }
  return false;
}

const ADMIN_FORCE_CANCEL_BLOCKED = ['SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const ADMIN_REASSIGN_ALLOWED = ['PENDING', 'WAITING_FOR_CONSOLIDATION'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const [showForceCancelModal, setShowForceCancelModal] = useState(false);
  const [forceCancelReason, setForceCancelReason] = useState('');

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignWarehouseId, setReassignWarehouseId] = useState('');

  // [FIX 1] State cho Reassign Modal
  const [consolidationPlans, setConsolidationPlans] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const { data: order, isLoading, isRefetching } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getById(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: role === 'ROLE_ADMIN',
  });

  // [FIX 3] Lấy danh sách phiếu chuyển kho liên quan khi đang chờ gom hàng
  const { data: relatedTransfers } = useQuery({
    queryKey: ['transfers-for-order', order?.id],
    queryFn: () => transferService.getAll({ size: 100 }).then(r => 
      r.data.data.content.filter((t: any) => t.referenceOrderId === order?.id)
    ),
    enabled: order?.status === 'WAITING_FOR_CONSOLIDATION',
  });

  // [FIX 1] Gọi API suggestBranch khi mở Modal Reassign
  useEffect(() => {
    if (showReassignModal && order) {
      setIsSuggesting(true);
      const payload = {
        provinceCode: order.provinceCode,
        items: order.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }))
      };
      orderService.suggestBranch(payload)
        .then(res => setConsolidationPlans(res.data?.data || []))
        .catch(() => setConsolidationPlans([]))
        .finally(() => setIsSuggesting(false));
    }
  }, [showReassignModal, order]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `VanDon_${order?.code || ''}`,
  });

  const actionMut = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: any }) => {
      switch (action) {
        case 'confirm':      return orderService.confirm(id!, body?.note);
        case 'pack':         return orderService.pack(id!, body?.note);
        case 'ship':         return orderService.ship(id!, body ?? {});
        case 'markReady':    return orderService.markReady(id!, body?.note);
        case 'complete':     return orderService.complete(id!, body?.note);
        case 'return':       return orderService.returnOrder(id!, body.reason);
        case 'cancel':       return orderService.cancel(id!, body.reason);
        case 'forceCancel':  return orderService.forceCancel(id!, body.reason);
        case 'reassign':     return orderService.reassign(id!, body.warehouseId);
        default: return Promise.reject(new Error('Hành động không hợp lệ'));
      }
    },
    onSuccess: async () => {
      toast.success('Cập nhật thành công');
      await qc.invalidateQueries({ queryKey: ['order', id] });
      setShowShippingModal(false);
      setShowCancelModal(false);
      setShowReturnModal(false);
      setShowForceCancelModal(false);
      setShowReassignModal(false);
      setCancelReason('');
      setReturnReason('');
      setForceCancelReason('');
      setReassignWarehouseId('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !order) return <PageLoader />;

  const next = getNextAction(order, role);
  const showCancelBtn = canCancelOrder(order, role);
  const showForceCancelBtn = role === 'ROLE_ADMIN' && !ADMIN_FORCE_CANCEL_BLOCKED.includes(order.status);
  const showReassignBtn = role === 'ROLE_ADMIN' && ADMIN_REASSIGN_ALLOWED.includes(order.status);

  const handleNextAction = () => {
    if (!next) return;
    if (next.needsShippingInfo) {
      setShippingProvider(order.shippingProvider || '');
      setTrackingCode(order.trackingCode || '');
      setShowShippingModal(true);
    } else if (next.needsReason) {
      setShowReturnModal(true);
    } else {
      actionMut.mutate({ action: next.action });
    }
  };

  const handleConfirmShipping = () => {
    actionMut.mutate({ action: 'ship', body: { shippingProvider, trackingCode } });
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) return toast.error('Vui lòng nhập lý do hủy đơn');
    actionMut.mutate({ action: 'cancel', body: { reason: cancelReason } });
  };

  const handleConfirmReturn = () => {
    if (!returnReason.trim()) return toast.error('Vui lòng nhập lý do hoàn trả');
    actionMut.mutate({ action: 'return', body: { reason: returnReason } });
  };

  const handleConfirmForceCancel = () => {
    if (forceCancelReason.trim().length < 20) {
      return toast.error('Lý do hủy khẩn cấp cần tối thiểu 20 ký tự để đảm bảo audit trail rõ ràng.');
    }
    actionMut.mutate({ action: 'forceCancel', body: { reason: forceCancelReason } });
  };

  const handleConfirmReassign = () => {
    if (!reassignWarehouseId) return toast.error('Vui lòng chọn chi nhánh mới');
    actionMut.mutate({ action: 'reassign', body: { warehouseId: reassignWarehouseId } });
  };

  // Helper tìm tên kho
  const getWarehouseName = (wid: string) => {
    return warehouses?.find((w: any) => w.id === wid)?.name || wid;
  };

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-6xl mx-auto relative">
      
      {/* ── HEADER KHU VỰC ĐIỀU HƯỚNG & TRẠNG THÁI ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 rounded-full bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm border border-slate-200 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-extrabold text-2xl md:text-3xl text-slate-900 tracking-tight">
                Đơn hàng <span className="text-indigo-600">{order.code}</span>
              </h1>
              <span className={`inline-flex items-center justify-center px-3 py-1 text-[11px] font-bold rounded-lg border uppercase tracking-wider shadow-sm ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
              <span className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider border flex items-center gap-1.5 shadow-sm ${order.type === 'BOPIS' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {order.type === 'BOPIS' ? <><Store className="w-3.5 h-3.5"/> Nhận tại quầy</> : <><Truck className="w-3.5 h-3.5"/> Giao tận nơi</>}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4"/> Ngày tạo: {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => handlePrint()}
            className="px-5 py-3 rounded-xl font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 shadow-sm flex-1 lg:flex-none justify-center"
          >
            <Printer className="w-4 h-4" /> In phiếu giao
          </button>

          {showCancelBtn && (
            <button 
              onClick={() => setShowCancelModal(true)} 
              disabled={actionMut.isPending || isRefetching} 
              className="px-5 py-3 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-2 shadow-sm flex-1 lg:flex-none justify-center disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Hủy đơn
            </button>
          )}

          {showReassignBtn && (
            <button
              onClick={() => setShowReassignModal(true)}
              disabled={actionMut.isPending}
              className="px-5 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-2 shadow-sm flex-1 lg:flex-none justify-center disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" /> Tái phân công
            </button>
          )}
          {showForceCancelBtn && (
            <button
              onClick={() => setShowForceCancelModal(true)}
              disabled={actionMut.isPending}
              className="px-5 py-3 rounded-xl font-bold text-sm bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-2 shadow-sm flex-1 lg:flex-none justify-center disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4" /> Hủy khẩn cấp
            </button>
          )}

          {next && (
            <button 
              onClick={handleNextAction} 
              disabled={actionMut.isPending || isRefetching}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 flex-1 lg:flex-none justify-center disabled:opacity-70 disabled:cursor-not-allowed ${next.className}`}
            >
              {actionMut.isPending ? <Spinner size="sm" className={next.className.includes('bg-rose-50') ? 'text-rose-700' : 'text-white'}/> : <><next.icon className="w-4 h-4" /> {next.label}</>}
            </button>
          )}
        </div>
      </div>

      {/* ── [FIX 3] TIẾN ĐỘ GOM HÀNG (NẾU CÓ) ── */}
      {order.status === 'WAITING_FOR_CONSOLIDATION' && relatedTransfers && relatedTransfers.length > 0 && (
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-amber-200 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-6 border-b border-amber-100 flex items-center gap-3 bg-amber-50/50">
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl"><Truck className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Tiến độ gom hàng (Luân chuyển nội bộ)</h3>
              <p className="text-sm text-slate-500 mt-0.5">Đơn hàng đang chờ các kho khác chuyển hàng về để đóng gói.</p>
            </div>
          </div>
          <div className="p-6 bg-white">
            <div className="space-y-3">
              {relatedTransfers.map((t: any) => (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                      <Package className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <Link to={`/transfers`} className="font-bold text-indigo-600 hover:underline text-sm">{t.code}</Link>
                      <p className="text-xs text-slate-500 mt-1">Từ kho: <span className="font-semibold text-slate-700">{getWarehouseName(t.fromWarehouseId)}</span></p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                      t.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      t.status === 'DISPATCHED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {t.status === 'DRAFT' ? 'Chờ xuất kho' : t.status === 'DISPATCHED' ? 'Đang vận chuyển' : t.status === 'RECEIVED' ? 'Đã nhận' : t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KHỐI GRID THÔNG TIN CHÍNH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-fade-in">
        
        {/* Customer & Shipping */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100/80 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><MapPin className="w-5 h-5" /></div>
            <h3 className="font-bold text-lg text-slate-900">Thông tin giao hàng</h3>
          </div>
          
          <div className="p-6 md:p-8 space-y-5 text-sm flex-1 bg-slate-50/30">
            <div className="flex justify-between items-start border-b border-slate-100/80 pb-4">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Người nhận</span>
              <span className="font-bold text-slate-900 text-right text-base">{order.shippingName}</span>
            </div>
            
            <div className="flex justify-between items-start border-b border-slate-100/80 pb-4">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Điện thoại</span>
              <span className="font-mono font-bold text-slate-800 text-base tracking-tight">{order.shippingPhone}</span>
            </div>
            
            {order.type === 'DELIVERY' ? (
              <>
                <div className="flex justify-between items-start border-b border-slate-100/80 pb-4 gap-6">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">Địa chỉ</span>
                  <span className="font-medium text-slate-800 text-right leading-relaxed">{order.shippingAddress}</span>
                </div>
                {order.shippingProvider && (
                  <div className="flex justify-between items-start border-b border-slate-100/80 pb-4">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Đơn vị vận chuyển</span>
                    <span className="font-bold text-slate-900">{order.shippingProvider}</span>
                  </div>
                )}
                {order.trackingCode && (
                  <div className="flex justify-between items-start border-b border-slate-100/80 pb-4">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Mã vận đơn</span>
                    <span className="font-mono font-bold text-indigo-600 tracking-tight bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{order.trackingCode}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl text-center shadow-sm">
                <p className="text-purple-800 font-bold text-base">Khách hàng nhận tại quầy</p>
                <p className="text-purple-600 text-sm font-medium mt-1.5 flex items-center justify-center gap-1.5">
                  <Store className="w-4 h-4"/> Chi nhánh: {order.assignedWarehouseName}
                </p>
              </div>
            )}
            
            {order.packedAt && (
              <div className="flex justify-between items-start border-b border-slate-100/80 pb-4">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Đóng gói bởi</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 flex items-center justify-end gap-1.5">
                    <User className="w-4 h-4 text-slate-400"/> {order.packedByName || order.packedBy || 'Hệ thống'}
                  </span>
                  <span className="text-slate-400 font-medium text-xs mt-1 inline-block">{formatDateTime(order.packedAt)}</span>
                </div>
              </div>
            )}
            
            {order.status === 'CANCELLED' && order.cancelledReason && (
               <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-sm shadow-sm">
                 <span className="font-bold block mb-1 uppercase text-xs tracking-wider text-rose-600">Lý do hủy:</span> 
                 <span className="font-medium">{order.cancelledReason}</span>
               </div>
            )}
          </div>
        </div>

        {/* Payment */}
        {order.finalAmount != null ? (
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100/80 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><CreditCard className="w-5 h-5" /></div>
              <h3 className="font-bold text-lg text-slate-900">Thanh toán</h3>
            </div>
            
            <div className="p-6 md:p-8 flex flex-col h-full justify-between bg-slate-50/30">
              <div className="space-y-5 text-sm">
                <div className="flex justify-between items-center border-b border-slate-100/80 pb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Phương thức</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/60">{order.paymentMethod}</span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-100/80 pb-4">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider text-xs">Trạng thái</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${
                      order.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      order.paymentStatus === 'REFUNDED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : order.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : 'Chưa TT'}
                    </span>
                    {order.paymentMethod === 'COD' && order.codReconciled && (
                       <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 shadow-sm uppercase tracking-wider">Đã đối soát</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Tổng sản phẩm</span>
                    <span className="font-semibold text-slate-700 text-base">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  {order.type === 'DELIVERY' && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Phí giao hàng</span>
                      <span className="font-semibold text-slate-700 text-base">{formatCurrency(order.shippingFee)}</span>
                    </div>
                  )}
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Giảm giá</span>
                      <span className="font-semibold text-emerald-600 text-base">- {formatCurrency(order.discountAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-end border-t border-slate-200/80 pt-6 mt-6">
                <span className="font-bold text-slate-800 text-base uppercase tracking-wider">Tổng thanh toán</span>
                <span className="text-3xl font-black text-indigo-600 tracking-tight leading-none">{formatCurrency(order.finalAmount)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl border border-slate-100 border-dashed flex items-center justify-center p-8 text-center">
            <p className="text-sm font-medium text-slate-400">Thông tin thanh toán chỉ hiển thị với Quản lý / Quản trị viên.</p>
          </div>
        )}
      </div>

      {/* ── BẢNG SẢN PHẨM ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Package className="w-5 h-5" /></div>
          <h3 className="font-bold text-lg text-slate-900">Danh sách Sản phẩm <span className="text-slate-500 font-medium ml-1">({order.items.length})</span></h3>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left min-w-[700px] text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-5">Tên sản phẩm</th>
                <th className="px-6 py-5">Mã vạch (SKU)</th>
                <th className="px-6 py-5 text-center">Số lượng</th>
                {order.finalAmount != null && <th className="px-6 py-5 text-right">Đơn giá</th>}
                {order.finalAmount != null && <th className="px-6 py-5 text-right">Thành tiền</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {order.items.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900 text-[14px]">{item.productName ?? item.productId}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs font-semibold">{item.isbnBarcode ?? '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block bg-slate-100 text-slate-800 font-black px-4 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                      {item.quantity}
                    </span>
                  </td>
                  {order.finalAmount != null && <td className="px-6 py-4 text-right font-semibold text-slate-600 tracking-tight">{formatCurrency(item.unitPrice)}</td>}
                  {order.finalAmount != null && <td className="px-6 py-4 text-right font-black text-indigo-600 tracking-tight text-base">{formatCurrency(item.subtotal)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TIMELINE LỊCH SỬ TRẠNG THÁI ── */}
      {(order.statusHistory ?? []).length > 0 && (
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Clock className="w-5 h-5" /></div>
            <h3 className="font-bold text-lg text-slate-900">Lịch sử trạng thái</h3>
          </div>
          
          <div className="p-8 md:p-10">
            <div className="relative border-l-2 border-slate-100 ml-4 md:ml-6 pl-8 md:pl-10 space-y-10">
              {order.statusHistory!.map((h: any, i: number) => {
                const isFirst = i === 0;
                let dotColor = "bg-slate-200 border-white";
                
                if (h.newStatus === 'DELIVERED') dotColor = "bg-emerald-500 border-white";
                else if (h.newStatus === 'CANCELLED' || h.newStatus === 'RETURNED') dotColor = "bg-rose-500 border-white";
                else if (isFirst) dotColor = "bg-indigo-500 border-indigo-100";
                else dotColor = "bg-blue-400 border-white";
                
                return (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[41px] md:-left-[49px] top-1 w-4 h-4 rounded-full border-4 shadow-sm ${dotColor} ${isFirst && 'animate-pulse'}`} />
                    
                    <div className={`bg-white border ${isFirst ? 'border-indigo-100 shadow-[0_4px_20px_rgb(99,102,241,0.05)]' : 'border-slate-100 shadow-sm'} rounded-2xl p-5 hover:shadow-md transition-all group`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
                        <span className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                          {getOrderStatusLabel(h.newStatus)}
                        </span>
                        <span className="text-slate-500 text-xs font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 shrink-0">
                          {formatDateTime(h.createdAt)}
                        </span>
                      </div>
                      
                      {h.note && (
                        <div className="text-slate-600 text-sm my-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100/50 leading-relaxed italic">
                          {h.note}
                        </div>
                      )}
                      
                      <div className="text-slate-500 text-xs mt-4 font-medium flex items-center gap-1.5 pt-3 border-t border-slate-50">
                        <User className="w-4 h-4 text-slate-400"/> Thực hiện bởi: 
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/60">
                           {h.changedByName || h.changedBy || 'Hệ thống'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Khu vực chứa Template in (Ẩn trên UI) */}
      <div className="hidden">
        <OrderPrintTemplate ref={printRef} order={order} />
      </div>

      {/* ── MODAL GIAO HÀNG ── */}
      {showShippingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">Thông tin Vận chuyển</h3>
              </div>
              <button onClick={() => setShowShippingModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 flex-1 bg-slate-50/30">
              <div className="bg-blue-50/50 text-blue-700 p-4 rounded-2xl text-sm font-medium border border-blue-100/50 leading-relaxed shadow-sm">
                Vui lòng nhập thông tin Đơn vị vận chuyển trước khi chuyển đơn sang trạng thái Đang giao.
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Đơn vị vận chuyển *</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="VD: GHTK, Viettel Post, Grab..." 
                    value={shippingProvider} 
                    onChange={e => setShippingProvider(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã vận đơn (Tracking Code)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="Nhập mã vận đơn..." 
                    value={trackingCode} 
                    onChange={e => setTrackingCode(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button onClick={() => setShowShippingModal(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Hủy bỏ</button>
              <button 
                onClick={handleConfirmShipping} 
                disabled={actionMut.isPending || !shippingProvider} 
                className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {actionMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận Giao hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HỦY ĐƠN (thường - Cashier/Manager) ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">Xác nhận Hủy đơn</h3>
              </div>
              <button onClick={() => setShowCancelModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 bg-slate-50/30 flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lý do hủy đơn <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all resize-none shadow-sm custom-scrollbar" 
                rows={4} 
                placeholder="Nhập lý do chi tiết..."
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                autoFocus 
              />
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button onClick={() => setShowCancelModal(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Đóng</button>
              <button 
                onClick={handleConfirmCancel} 
                disabled={actionMut.isPending || !cancelReason.trim()} 
                className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(225,29,72,0.3)] hover:bg-rose-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {actionMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HOÀN TRẢ ── */}
      {showReturnModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">Hoàn trả đơn hàng</h3>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 bg-slate-50/30 flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lý do hoàn trả <span className="text-amber-500">*</span></label>
              <textarea 
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none shadow-sm custom-scrollbar" 
                rows={4} 
                placeholder="Nhập lý do khách trả hàng..."
                value={returnReason} 
                onChange={e => setReturnReason(e.target.value)} 
                autoFocus 
              />
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button onClick={() => setShowReturnModal(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Đóng</button>
              <button 
                onClick={handleConfirmReturn} 
                disabled={actionMut.isPending || !returnReason.trim()} 
                className="flex items-center justify-center min-w-[180px] px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(245,158,11,0.3)] hover:bg-amber-600 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {actionMut.isPending ? <Spinner size="sm" className="text-white"/> : <><RotateCcw className="w-4 h-4 mr-1.5" /> Xác nhận Hoàn trả</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HỦY KHẨN CẤP (ADMIN ONLY) ── */}
      {showForceCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">Hủy khẩn cấp (Admin)</h3>
              </div>
              <button onClick={() => setShowForceCancelModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 bg-slate-50/30 flex-1 space-y-3">
              <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl text-sm font-medium border border-rose-100 leading-relaxed">
                Hành động này sẽ được ghi vào nhật ký kiểm toán (audit log) và Quản lý chi nhánh sẽ nhận thông báo ngay.
              </div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Lý do (bắt buộc, tối thiểu 20 ký tự) <span className="text-rose-500">*</span>
              </label>
              <textarea 
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all resize-none shadow-sm custom-scrollbar" 
                rows={4} 
                placeholder="Mô tả chi tiết lý do hủy khẩn cấp..."
                value={forceCancelReason} 
                onChange={e => setForceCancelReason(e.target.value)} 
                autoFocus 
              />
              <p className="text-xs text-slate-400 text-right">{forceCancelReason.trim().length}/20 ký tự</p>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button onClick={() => setShowForceCancelModal(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Đóng</button>
              <button 
                onClick={handleConfirmForceCancel} 
                disabled={actionMut.isPending || forceCancelReason.trim().length < 20} 
                className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(225,29,72,0.3)] hover:bg-rose-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {actionMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận Hủy khẩn cấp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [FIX 1] MODAL TÁI PHÂN CÔNG (ADMIN ONLY) ── */}
      {showReassignModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 tracking-tight">Tái phân công chi nhánh</h3>
              </div>
              <button onClick={() => setShowReassignModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 bg-slate-50/30 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              <p className="text-sm text-slate-500 mb-2">
                Chỉ áp dụng khi đơn chưa được Quản lý xác nhận - đơn sẽ quay về trạng thái <b>Chờ xác nhận</b> ở chi nhánh mới.
              </p>
              
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" /> Tình trạng tồn kho các chi nhánh
                {isSuggesting && <Spinner size="sm" className="ml-2 text-indigo-500" />}
              </h4>

              <div className={`space-y-3 transition-opacity duration-300 ${isSuggesting ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {consolidationPlans.filter(p => p.warehouseId !== order.assignedWarehouseId).map((plan: any) => {
                  const isSelected = reassignWarehouseId === plan.warehouseId;
                  const canFulfill = plan.isReadyToShip;
                  
                  return (
                    <div 
                      key={plan.warehouseId} 
                      onClick={() => canFulfill && setReassignWarehouseId(plan.warehouseId)} 
                      className={`p-4 rounded-xl border-2 transition-all ${
                        !canFulfill ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed' :
                        isSelected ? 'border-indigo-500 bg-white shadow-md cursor-pointer' : 'border-slate-200 bg-white hover:border-indigo-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-slate-900">
                          {plan.warehouseName} 
                          {plan.isSameProvince && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded ml-2">Cùng Tỉnh</span>}
                        </p>
                        {canFulfill ? (
                          isSelected ? <CheckCircle2 className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300"/>
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      {canFulfill ? (
                        <p className="text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">✓ Đủ hàng. Có thể phân công</p>
                      ) : (
                        <p className="text-sm text-rose-600 bg-rose-50 px-2 py-1 rounded inline-block">✗ Thiếu hàng. Không thể phân công</p>
                      )}
                    </div>
                  );
                })}
                {consolidationPlans.length <= 1 && !isSuggesting && (
                  <p className="text-sm text-slate-500 italic">Không có chi nhánh nào khác để phân công.</p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button onClick={() => setShowReassignModal(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Đóng</button>
              <button 
                onClick={handleConfirmReassign} 
                disabled={actionMut.isPending || !reassignWarehouseId} 
                className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(0,0,0,0.2)] hover:bg-slate-800 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {actionMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận tái phân công'}
              </button>
            </div>
          </div>
        </div>
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