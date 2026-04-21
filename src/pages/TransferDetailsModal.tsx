import React, { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Package, Info, Clock, MapPin, Printer, ShoppingBag, ArrowLeftRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { transferService } from '@/services/transfer.service';
import { warehouseService } from '@/services/warehouse.service';
import { productService } from '@/services/product.service';
import { formatDateTime } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { TransferPrintTemplate } from './TransferPrintTemplate';

// Tiện ích map trạng thái
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  DISPATCHED: { label: 'Đang vận chuyển', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED: { label: 'Đã nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

interface Props {
  transferId: string;
  onClose: () => void;
}

export function TransferDetailsModal({ transferId, onClose }: Props) {
  // === HOOK CHO TÍNH NĂNG IN ===
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Phieu_Chuyen_Kho_${transferId}`,
  });

  // 1. Lấy chi tiết phiếu chuyển
  const { data: transfer, isLoading } = useQuery({
    queryKey: ['transfer-detail', transferId],
    queryFn: () => transferService.getById(transferId).then(r => r.data.data),
    enabled: !!transferId,
  });

  // 2. Lấy danh sách chi nhánh để map tên
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  // 3. Lấy danh sách sản phẩm để map tên
  const { data: products } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouses?.forEach((w: any) => map.set(w.id, w.name));
    return map;
  }, [warehouses]);

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products?.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [products]);

  if (isLoading || !transfer) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all">
        <Spinner size="lg" className="text-white" />
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 transition-all">
      
      {/* ── KHUNG VIỀN TRẮNG 1CM BAO NGOÀI ── */}
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] animate-slide-up p-3 md:p-4">
        
        {/* ── NỘI DUNG MODAL (Nằm lọt lòng trong khung trắng) ── */}
        <div className="rounded-xl overflow-hidden flex flex-col flex-1 border border-slate-100 bg-slate-50/30 relative">
          
          {/* ── HEADER ── */}
          <div className="px-5 sm:px-6 py-4 flex justify-between items-center border-b border-slate-100 bg-white shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Chi tiết Phiếu chuyển <span className="text-indigo-600 ml-1">{transfer.code}</span>
                  </h2>
                  {STATUS_BADGE[transfer.status] ? (
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${STATUS_BADGE[transfer.status].className}`}>
                      {STATUS_BADGE[transfer.status].label}
                    </span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm bg-slate-100 text-slate-600 border-slate-200">
                      {transfer.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">Điều chuyển hàng hóa giữa các kho / chi nhánh</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handlePrint()} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> <span className="hidden sm:inline">In phiếu</span>
              </button>
              <button 
                onClick={onClose} 
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── BODY ── */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CỘT TRÁI: THÔNG TIN TRACKING & GHI CHÚ */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Tuyến đường */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><MapPin className="w-4 h-4" /></div>
                    Tuyến đường
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Từ kho (Xuất)</p>
                      <p className="font-bold text-slate-800 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100">
                        {warehouseMap.get(transfer.fromWarehouseId) || transfer.fromWarehouseId}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Đến kho (Nhập)</p>
                      <p className="font-bold text-slate-800 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100">
                        {warehouseMap.get(transfer.toWarehouseId) || transfer.toWarehouseId}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Thời gian */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
                    Thời gian (Tracking)
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-500">Ngày tạo phiếu</span>
                      <span className="text-sm font-bold text-slate-800">{formatDateTime(transfer.createdAt)}</span>
                    </div>
                    
                    {transfer.dispatchedAt && (
                      <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                        <span className="text-sm font-medium text-slate-500">Thời gian xuất kho</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                          {formatDateTime(transfer.dispatchedAt)}
                        </span>
                      </div>
                    )}

                    {transfer.receivedAt && (
                      <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                        <span className="text-sm font-medium text-slate-500">Thời gian nhận</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg">
                          {formatDateTime(transfer.receivedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ghi chú */}
                {transfer.note && (
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm">
                    <h3 className="font-bold text-blue-800 text-[11px] mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Ghi chú / Lý do:
                    </h3>
                    <p className="text-sm text-blue-900/80 font-medium leading-relaxed italic">"{transfer.note}"</p>
                  </div>
                )}

                {/* Thông báo Đơn gom */}
                {transfer.referenceOrderId && (
                  <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                    <h3 className="font-bold text-indigo-800 flex items-center gap-2 mb-2">
                      <ShoppingBag className="w-4 h-4" /> Đơn hàng chờ gom
                    </h3>
                    <p className="text-[13px] text-indigo-900/80 leading-relaxed font-medium">
                      Phiếu này được tạo tự động để luân chuyển hàng hóa phục vụ cho Đơn hàng Online. 
                      Khi bạn bấm <b>Nhận hàng</b>, Đơn hàng gốc sẽ được kích hoạt để đóng gói.
                    </p>
                  </div>
                )}
                
              </div>

              {/* CỘT PHẢI: DANH SÁCH HÀNG HÓA */}
              <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col flex-1">
                  
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5 shrink-0">
                    <div className="p-1.5 bg-slate-200 text-slate-600 rounded-lg"><Package className="w-4 h-4" /></div>
                    <h3 className="font-bold text-slate-900">Chi tiết hàng hóa <span className="text-slate-500 font-medium ml-1">({transfer.items.length})</span></h3>
                  </div>
                  
                  <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                    <table className="w-full text-sm text-left min-w-[500px]">
                      <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3">Sản phẩm</th>
                          <th className="px-5 py-3 text-center">Số lượng gửi</th>
                          <th className="px-5 py-3 text-center">Thực nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(transfer.items || []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-16 text-center text-slate-500 font-medium">Không có sản phẩm nào trong phiếu này.</td>
                          </tr>
                        ) : (
                          transfer.items.map((item: any) => {
                            const productInfo = productMap.get(item.productId);
                            const isReceived = transfer.status === 'RECEIVED';
                            const isShortage = isReceived && item.receivedQty < item.quantity;
                            
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-5 py-4">
                                  <p className="font-bold text-slate-800 leading-snug">{productInfo?.name || 'Đang tải...'}</p>
                                  <p className="text-[11px] text-slate-400 font-mono font-semibold mt-1">SKU: {productInfo?.isbnBarcode || item.productId.slice(0,8)}</p>
                                </td>
                                
                                <td className="px-5 py-4 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 font-bold text-slate-700 bg-slate-100 rounded-lg border border-slate-200/60 shadow-sm">
                                    {item.quantity}
                                  </span>
                                </td>
                                
                                <td className="px-5 py-4 text-center">
                                  {isReceived ? (
                                    <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 font-bold rounded-lg border shadow-sm ${
                                      isShortage 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {item.receivedQty}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic font-medium text-xs">Chờ nhận...</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex justify-end shrink-0 z-10">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Đóng cửa sổ
            </button>
          </div>

          {/* ── KHỐI IN ẨN ── */}
          <div className="hidden">
            <TransferPrintTemplate 
              ref={printRef} 
              transfer={transfer} 
              warehouses={warehouses || []} 
              products={products || []}
            />
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}