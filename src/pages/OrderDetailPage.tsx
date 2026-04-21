import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, CreditCard, Package, Clock, Truck, Store, CheckCircle, XCircle, RotateCcw, Printer, ChevronRight, User } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { orderService } from '@/services/order.service';
import { authService } from '@/services/auth.service';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { OrderPrintTemplate } from './OrderPrintTemplate';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  // State map UUID -> Tên nhân viên
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  
  // Ref in ấn
  const printRef = useRef<HTMLDivElement>(null);

  // Gọi API lấy danh sách User
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await authService.getUsers();
        const users = res.data.data;
        const mapping = users.reduce((acc: any, u: any) => {
          acc[u.id] = u.fullName;
          return acc;
        }, {});
        setUserMap(mapping);
      } catch (error) {
        console.error('Lỗi tải danh sách người dùng', error);
      }
    };
    fetchUsers();
  }, []);

  const renderUserName = (uuid?: string | null) => {
    if (!uuid) return "Hệ thống";
    return userMap[uuid] || uuid; // Trả về Tên nếu có, không thì hiện UUID
  };

  const { data: order, isLoading, isRefetching } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getById(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `VanDon_${order?.code || ''}`,
  });

  const updateMut = useMutation({
    mutationFn: (body: { status: string; note?: string; trackingCode?: string; shippingProvider?: string }) =>
      orderService.updateStatus(id!, body),
    onSuccess: async () => { 
      toast.success('Cập nhật thành công'); 
      await qc.invalidateQueries({ queryKey: ['order', id] }); 
      setShowShippingModal(false);
      setShowCancelModal(false);
      setShowReturnModal(false); 
      setCancelReason('');
      setReturnReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi'),
  });

  if (isLoading || !order) return <PageLoader />;

  // Cập nhật lại giao diện các nút thao tác
  const nextActions: Record<string, { label: string; status: string; className: string; icon: React.ElementType }> = {
    PENDING:  { label: 'Chuyển sang Đóng gói', status: 'PACKING',   className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 border-transparent', icon: Package },
    PACKING:  { label: 'Chuyển sang Đang giao', status: 'SHIPPING',  className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 border-transparent', icon: Truck },
    SHIPPING: { label: 'Xác nhận Đã giao',      status: 'DELIVERED', className: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 border-transparent', icon: CheckCircle },
    DELIVERED: { label: 'Hoàn trả đơn hàng',     status: 'RETURNED',  className: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100', icon: RotateCcw }
  };

  const next = nextActions[order.status];

  const handleNextAction = () => {
    if (next.status === 'SHIPPING' && order.type !== 'BOPIS') {
      setShippingProvider(order.shippingProvider || '');
      setTrackingCode(order.trackingCode || '');
      setShowShippingModal(true);
    } else if (next.status === 'RETURNED') {
      setShowReturnModal(true);
    } else {
      updateMut.mutate({ status: next.status });
    }
  };

  const handleConfirmShipping = () => {
    updateMut.mutate({ status: 'SHIPPING', shippingProvider, trackingCode });
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) return toast.error('Vui lòng nhập lý do hủy đơn');
    updateMut.mutate({ status: 'CANCELLED', note: cancelReason });
  };

  const handleConfirmReturn = () => {
    if (!returnReason.trim()) return toast.error('Vui lòng nhập lý do hoàn trả');
    updateMut.mutate({ status: 'RETURNED', note: `Lý do hoàn trả: ${returnReason}` });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* ── HEADER KHU VỰC ĐIỀU HƯỚNG & TRẠNG THÁI ── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors border border-slate-200 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight">Đơn hàng <span className="text-indigo-600">{order.code}</span></h2>
              <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-lg border shadow-sm uppercase tracking-wider ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider border flex items-center gap-1.5 shadow-sm ${order.type === 'BOPIS' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {order.type === 'BOPIS' ? <><Store className="w-3 h-3"/> Nhận tại quầy</> : <><Truck className="w-3 h-3"/> Giao tận nơi</>}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4"/> Ngày tạo: {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* NÚT IN VẬN ĐƠN */}
          <button 
            onClick={() => handlePrint()}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 shadow-sm flex-1 xl:flex-none justify-center"
          >
            <Printer className="w-4 h-4" /> In phiếu giao
          </button>

          {(order.status === 'PENDING' || order.status === 'PACKING') && (
            <button 
              onClick={() => setShowCancelModal(true)} 
              disabled={updateMut.isPending || isRefetching} 
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-2 shadow-sm flex-1 xl:flex-none justify-center disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Hủy đơn
            </button>
          )}

          {next && (
            <button 
              onClick={handleNextAction} 
              disabled={updateMut.isPending || isRefetching}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 flex-1 xl:flex-none justify-center disabled:opacity-70 disabled:cursor-not-allowed ${next.className}`}
            >
              {updateMut.isPending ? <Spinner size="sm" className="text-current"/> : <><next.icon className="w-4 h-4" /> {next.label}</>}
            </button>
          )}
        </div>
      </div>

      {/* ── KHỐI GRID THÔNG TIN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Customer & shipping */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><MapPin className="w-4 h-4" /></div>
            <h3 className="font-bold text-slate-900">Thông tin giao hàng</h3>
          </div>
          
          <div className="p-5 space-y-4 text-[13px] sm:text-sm flex-1">
            <div className="flex justify-between items-start border-b border-slate-50 pb-3">
              <span className="text-slate-500 font-medium">Người nhận</span>
              <span className="font-bold text-slate-900 text-right">{order.shippingName}</span>
            </div>
            
            <div className="flex justify-between items-start border-b border-slate-50 pb-3">
              <span className="text-slate-500 font-medium">Điện thoại</span>
              <span className="font-mono font-bold text-slate-800 tracking-tight">{order.shippingPhone}</span>
            </div>
            
            {order.type === 'DELIVERY' ? (
              <>
                <div className="flex justify-between items-start border-b border-slate-50 pb-3 gap-4">
                  <span className="text-slate-500 font-medium whitespace-nowrap">Địa chỉ</span>
                  <span className="font-medium text-slate-800 text-right leading-relaxed">{order.shippingAddress}</span>
                </div>
                {order.shippingProvider && (
                  <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                    <span className="text-slate-500 font-medium">Đơn vị vận chuyển</span>
                    <span className="font-bold text-slate-900">{order.shippingProvider}</span>
                  </div>
                )}
                {order.trackingCode && (
                  <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                    <span className="text-slate-500 font-medium">Mã vận đơn</span>
                    <span className="font-mono font-bold text-indigo-600 tracking-tight">{order.trackingCode}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 p-3.5 bg-purple-50/80 border border-purple-100 rounded-xl text-center">
                <p className="text-purple-800 font-bold">Khách hàng sẽ đến lấy tại quầy</p>
                <p className="text-purple-600 text-xs font-medium mt-1">Chi nhánh: {order.assignedWarehouseName}</p>
              </div>
            )}
            
            {order.packedAt && (
              <div className="flex justify-between items-start border-b border-slate-50 pb-3">
                <span className="text-slate-500 font-medium">Đóng gói bởi</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 flex items-center justify-end gap-1"><User className="w-3 h-3 text-slate-400"/> {renderUserName(order.packedBy)}</span>
                  <span className="text-slate-400 font-medium text-xs mt-0.5 inline-block">{formatDateTime(order.packedAt)}</span>
                </div>
              </div>
            )}
            
            {order.status === 'CANCELLED' && order.cancelledReason && (
               <div className="mt-2 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-sm">
                 <span className="font-bold block mb-1">Lý do hủy:</span> {order.cancelledReason}
               </div>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><CreditCard className="w-4 h-4" /></div>
            <h3 className="font-bold text-slate-900">Thanh toán</h3>
          </div>
          
          <div className="p-5 flex flex-col h-full justify-between">
            <div className="space-y-4 text-[13px] sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Phương thức</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">{order.paymentMethod}</span>
              </div>
              
              <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                <span className="text-slate-500 font-medium">Trạng thái</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${order.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa TT'}
                  </span>
                  {order.paymentMethod === 'COD' && order.codReconciled && (
                     <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shadow-sm uppercase tracking-wider">Đã đối soát</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Tổng sản phẩm</span>
                  <span className="font-semibold text-slate-700 tracking-tight">{formatCurrency(order.totalAmount)}</span>
                </div>
                {order.type === 'DELIVERY' && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Phí giao hàng</span>
                    <span className="font-semibold text-slate-700 tracking-tight">{formatCurrency(order.shippingFee)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-end border-t border-slate-100 pt-5 mt-5">
              <span className="font-bold text-slate-800 text-base">Tổng thanh toán</span>
              <span className="text-2xl font-black text-indigo-600 tracking-tight leading-none">{formatCurrency(order.finalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BẢNG SẢN PHẨM ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Package className="w-4 h-4" /></div>
          <h3 className="font-bold text-slate-900">Danh sách Sản phẩm <span className="text-slate-500 font-medium ml-1">({order.items.length})</span></h3>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Tên sản phẩm</th>
                <th className="px-5 py-4">Mã vạch (SKU)</th>
                <th className="px-5 py-4 text-center">Số lượng</th>
                <th className="px-5 py-4 text-right">Đơn giá</th>
                <th className="px-5 py-4 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {order.items.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-800">{item.productName ?? item.productId}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-500 text-xs font-semibold">{item.isbnBarcode ?? '-'}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-slate-700 bg-slate-50/50 w-24">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-600 tracking-tight">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3.5 text-right font-black text-indigo-600 tracking-tight">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TIMELINE LỊCH SỬ TRẠNG THÁI ── */}
      {(order.statusHistory ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Clock className="w-4 h-4" /></div>
            <h3 className="font-bold text-slate-900">Lịch sử trạng thái</h3>
          </div>
          
          <div className="p-6 md:p-8">
            <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 pl-6 md:pl-8 space-y-8">
              {order.statusHistory!.map((h: any, i: number) => {
                // Xác định icon và màu cho timeline dot
                const isLast = i === order.statusHistory!.length - 1;
                const isFirst = i === 0;
                let dotColor = "bg-slate-300";
                
                if (h.newStatus === 'DELIVERED') dotColor = "bg-emerald-500";
                else if (h.newStatus === 'CANCELLED' || h.newStatus === 'RETURNED') dotColor = "bg-rose-500";
                else if (isFirst) dotColor = "bg-indigo-500"; // Trạng thái hiện tại
                else dotColor = "bg-blue-400";
                
                return (
                  <div key={i} className="relative">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[31px] md:-left-[39px] top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-white shadow-sm ${dotColor} ${isFirst && 'animate-pulse'}`} />
                    
                    {/* Content Card */}
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <span className="font-bold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors">
                          {getOrderStatusLabel(h.newStatus)}
                        </span>
                        <span className="text-slate-400 text-xs font-semibold bg-slate-50 px-2 py-1 rounded-md shrink-0">
                          {formatDateTime(h.createdAt)}
                        </span>
                      </div>
                      
                      {h.note && (
                        <div className="text-slate-600 text-sm mt-2 mb-3 bg-slate-50/80 p-3 rounded-lg border border-slate-100/50 leading-relaxed italic">
                          {h.note}
                        </div>
                      )}
                      
                      <div className="text-slate-500 text-xs mt-3 font-medium flex items-center gap-1.5 pt-3 border-t border-slate-50">
                        <User className="w-3.5 h-3.5 text-slate-400"/> Thực hiện bởi: 
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {renderUserName(h.changedBy)}
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

      {/* ── MODALS ── */}
      
      {/* MODAL GIAO HÀNG */}
      {showShippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Thông tin vận chuyển</h3>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm font-medium border border-blue-100 leading-relaxed">
                Vui lòng nhập thông tin Đơn vị vận chuyển trước khi chuyển đơn sang trạng thái Đang giao.
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Đơn vị vận chuyển</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" 
                    placeholder="VD: GHTK, Viettel Post, Grab..." 
                    value={shippingProvider} 
                    onChange={e => setShippingProvider(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã vận đơn (Tracking Code)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-mono font-bold tracking-tight" 
                    placeholder="Nhập mã vận đơn..." 
                    value={trackingCode} 
                    onChange={e => setTrackingCode(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowShippingModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
              <button onClick={handleConfirmShipping} disabled={updateMut.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[150px]">
                {updateMut.isPending ? <Spinner size="sm"/> : 'Xác nhận Giao hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỦY ĐƠN */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
              <div className="p-2 bg-rose-100 rounded-lg">
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Xác nhận Hủy đơn</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Lý do hủy đơn <span className="text-rose-500">*</span></label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 block p-3 transition-colors outline-none resize-none" 
                rows={4} 
                placeholder="Nhập lý do chi tiết..."
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                autoFocus 
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowCancelModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Đóng</button>
              <button onClick={handleConfirmCancel} disabled={updateMut.isPending || !cancelReason.trim()} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[140px]">
                {updateMut.isPending ? <Spinner size="sm"/> : 'Xác nhận Hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HOÀN TRẢ */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-amber-50/50">
              <div className="p-2 bg-amber-100 rounded-lg">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Hoàn trả đơn hàng</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Lý do hoàn trả <span className="text-amber-500">*</span></label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 block p-3 transition-colors outline-none resize-none" 
                rows={4} 
                placeholder="Nhập lý do khách trả hàng..."
                value={returnReason} 
                onChange={e => setReturnReason(e.target.value)} 
                autoFocus 
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowReturnModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Đóng</button>
              <button onClick={handleConfirmReturn} disabled={updateMut.isPending || !returnReason.trim()} className="px-5 py-2.5 rounded-xl text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[180px]">
                {updateMut.isPending ? <Spinner size="sm" className="text-amber-700"/> : <><RotateCcw className="w-4 h-4 mr-1.5" /> Xác nhận Hoàn trả</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}