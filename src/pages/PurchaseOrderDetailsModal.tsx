import React, { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Package, Info, Clock, Building2, Store, Printer, ClipboardList } from 'lucide-react';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-slate-50/50 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up border border-slate-200/50 backdrop-blur-md">
        
        {/* ── HEADER ── */}
        <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hidden sm:block">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Chi tiết Phiếu: <span className="text-indigo-600">{po.code}</span></h2>
                <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${getPurchaseStatusColor(po.status)}`}>
                  {STATUS_LABELS[po.status] || po.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-1">Hệ thống Quản lý Nhập Kho</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handlePrint()} 
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">In phiếu</span>
            </button>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CỘT TRÁI: THÔNG TIN & THỜI GIAN */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Thông tin chung */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-50 pb-3">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Info className="w-4 h-4" /></div>
                  Thông tin chung
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider"><Building2 className="w-3.5 h-3.5"/> Nhà cung cấp</p>
                    <p className="font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">{supplierMap.get(po.supplierId) || po.supplierId}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider"><Store className="w-3.5 h-3.5"/> Nhập tại kho</p>
                    <p className="font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">{warehouseMap.get(po.warehouseId) || po.warehouseId}</p>
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-50 pb-3">
                  <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
                  Thời gian
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <p className="text-sm font-medium text-slate-500">Ngày tạo phiếu</p>
                    <p className="text-sm font-bold text-slate-800">{formatDateTime(po.createdAt)}</p>
                  </div>
                  {po.approvedAt && (
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-slate-500">Ngày duyệt <span className="text-xs font-normal">(Hoàn tất)</span></p>
                      <p className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{formatDateTime(po.approvedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              {po.note && (
                <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 shadow-sm">
                  <h3 className="font-bold text-amber-800 text-sm mb-2 uppercase tracking-wider">Ghi chú / Lý do:</h3>
                  <p className="text-sm text-amber-900/80 font-medium leading-relaxed italic">"{po.note}"</p>
                </div>
              )}
            </div>

            {/* CỘT PHẢI: SẢN PHẨM & TỔNG TIỀN */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Package className="w-4 h-4" /></div>
                  <h3 className="font-bold text-slate-900">Danh sách hàng hóa <span className="text-slate-500 font-medium ml-1">({po.items?.length || 0})</span></h3>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                  <table className="w-full text-sm text-left min-w-[500px]">
                    <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-center">Số lượng</th>
                        <th className="px-4 py-3 text-right">Giá nhập</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(po.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-16 text-center text-slate-500 font-medium">Không có sản phẩm nào trong phiếu này.</td>
                        </tr>
                      ) : (
                        po.items.map((item: any) => {
                          const productInfo = productMap.get(item.productId);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-slate-800 leading-snug">{productInfo?.name || 'Đang tải...'}</p>
                                <p className="text-[11px] text-slate-400 font-mono font-semibold mt-1">SKU: {productInfo?.isbnBarcode || item.productId.slice(0,8)}</p>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className="inline-block px-3 py-1 font-bold text-slate-700 bg-slate-100 rounded-lg">{item.quantity}</span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold text-slate-600 tracking-tight">
                                {formatCurrency(item.importPrice)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-black text-indigo-600 tracking-tight text-[15px]">
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
                <div className="bg-indigo-50 border-t border-indigo-100 p-5 sm:px-6 flex justify-between items-center">
                  <span className="font-extrabold text-indigo-800 uppercase tracking-wider text-sm">Tổng cộng thanh toán</span>
                  <span className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight leading-none">
                    {formatCurrency(po.totalAmount)}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
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