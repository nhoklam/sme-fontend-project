import React, { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Package, Info, Clock, Building2, Store, Printer, ClipboardList, CheckCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { purchaseService } from '@/services/purchase.service';
import { productService } from '@/services/product.service';
import { supplierService } from '@/services/supplier.service';
import { warehouseService } from '@/services/warehouse.service';
import { formatCurrency, formatDateTime, getPurchaseStatusColor } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { PurchaseOrderPrintTemplate } from './PurchaseOrderPrintTemplate';

// Tiện ích map tiếng Việt cho trạng thái
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ duyệt',
  COMPLETED: 'Đã nhập kho',
  CANCELLED: 'Đã hủy'
};

interface Props {
  purchaseOrderId: string;
  onClose: () => void;
}

export function PurchaseOrderDetailsModal({ purchaseOrderId, onClose }: Props) {
  
  const printRef = useRef<HTMLDivElement>(null);

  const { data: po, isLoading: loadingPo } = useQuery({
    queryKey: ['po-detail', purchaseOrderId],
    queryFn: () => purchaseService.getById(purchaseOrderId).then(r => r.data.data),
    enabled: !!purchaseOrderId,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Phieu_Nhap_Kho_${po?.code || ''}`,
  });

  const { data: products } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll({ size: 1000 }).then(r => r.data.data.content),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products?.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [products]);

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


  if (loadingPo || !po) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <Spinner size="lg" className="text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-in border border-slate-100">
        
        {/* ── HEADER ── */}
        <div className="px-6 md:px-8 py-5 md:py-6 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hidden sm:flex items-center justify-center shadow-sm">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Chi tiết Phiếu: <span className="text-indigo-600">{po.code}</span></h2>
                <span className={`inline-flex px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${getPurchaseStatusColor(po.status).replace('bg-','bg-').replace('text-','text-').replace('border-','border-')}`}>
                  {STATUS_LABELS[po.status] || po.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-1">Hệ thống Quản lý Nhập Kho</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handlePrint()} 
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">In phiếu</span>
            </button>
            <button 
              onClick={onClose} 
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-100 rounded-full hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            
            {/* CỘT TRÁI: THÔNG TIN & THỜI GIAN */}
            <div className="lg:col-span-1 space-y-6 md:space-y-8">
              
              {/* Thông tin chung */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] space-y-5 flex flex-col">
                <div className="flex items-center gap-3 border-b border-slate-100/80 pb-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Info className="w-4 h-4" /></div>
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">Thông tin chung</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400"/> Nhà cung cấp</p>
                    <p className="font-bold text-slate-800 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 shadow-sm">{supplierMap.get(po.supplierId) || po.supplierId}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-slate-400"/> Nhập tại kho</p>
                    <p className="font-bold text-slate-800 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 shadow-sm">{warehouseMap.get(po.warehouseId) || po.warehouseId}</p>
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100/80 pb-4">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-4 h-4" /></div>
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">Thời gian xử lý</h3>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Ngày tạo phiếu</p>
                    <p className="font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">{formatDateTime(po.createdAt)}</p>
                  </div>
                  {po.approvedAt && (
                    <div className="flex justify-between items-center pt-1">
                      <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1">Ngày duyệt <CheckCircle className="w-3 h-3 text-emerald-500"/></p>
                      <p className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/60 shadow-sm">{formatDateTime(po.approvedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              {po.note && (
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />
                  <h3 className="font-bold text-amber-800 text-[11px] mb-2.5 uppercase tracking-wider flex items-center gap-1.5 relative z-10">
                    <Info className="w-3.5 h-3.5" /> Ghi chú / Lý do
                  </h3>
                  <p className="text-sm text-amber-900/80 font-medium leading-relaxed italic relative z-10">"{po.note}"</p>
                </div>
              )}
            </div>

            {/* CỘT PHẢI: SẢN PHẨM & TỔNG TIỀN */}
            <div className="lg:col-span-2 flex flex-col h-full">
              
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col flex-1">
                <div className="p-6 border-b border-slate-100/80 flex items-center gap-3 bg-white">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Package className="w-5 h-5" /></div>
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">Danh sách hàng hóa <span className="text-slate-500 font-medium ml-1">({po.items?.length || 0})</span></h3>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
                  <table className="w-full text-sm text-left min-w-[600px] text-slate-600">
                    <thead className="text-[11px] text-slate-500 uppercase font-semibold bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100 tracking-wider">
                      <tr>
                        <th className="px-6 py-5">Sản phẩm</th>
                        <th className="px-6 py-5 text-center">Số lượng</th>
                        <th className="px-6 py-5 text-right">Giá nhập</th>
                        <th className="px-6 py-5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50/80">
                      {(po.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-24 text-center text-slate-500 font-medium bg-slate-50/30">
                            Không có sản phẩm nào trong phiếu này.
                          </td>
                        </tr>
                      ) : (
                        po.items.map((item: any) => {
                          const productInfo = productMap.get(item.productId);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900 leading-snug text-[14px]">{productInfo?.name || 'Đang tải...'}</p>
                                <p className="text-[11px] text-slate-400 font-mono font-semibold mt-1 bg-slate-50 w-max px-2 py-0.5 rounded">SKU: {productInfo?.isbnBarcode || item.productId.slice(0,8)}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-block px-4 py-1.5 font-black text-slate-800 bg-slate-100 border border-slate-200/60 shadow-sm rounded-lg">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-semibold text-slate-600 tracking-tight">
                                {formatCurrency(item.importPrice)}
                              </td>
                              <td className="px-6 py-4 text-right font-black text-indigo-600 tracking-tight text-base">
                                {formatCurrency(item.quantity * item.importPrice)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Tổng kết */}
                <div className="bg-slate-50/50 border-t border-slate-100 p-6 md:p-8 flex justify-between items-center shrink-0">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Tổng cộng thanh toán</span>
                  <span className="text-3xl md:text-4xl font-black text-indigo-600 tracking-tight leading-none drop-shadow-sm">
                    {formatCurrency(po.totalAmount)}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-white flex justify-end shrink-0 rounded-b-3xl">
          <button 
            onClick={onClose} 
            className="px-8 py-3 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm"
          >
            Đóng cửa sổ
          </button>
        </div>

        {/* ── KHỐI IN ẨN ── */}
        <div className="hidden">
          <PurchaseOrderPrintTemplate 
            ref={printRef} 
            orderData={po} 
            products={products || []}
            suppliers={suppliers || []}
            warehouses={warehouses || []}
          />
        </div>

      </div>
    </div>
  );
}