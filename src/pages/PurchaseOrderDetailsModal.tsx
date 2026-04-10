import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Package, Info, Clock, Building2, Store } from 'lucide-react';
import { purchaseService } from '@/services/purchase.service';
import { productService } from '@/services/product.service';
import { supplierService } from '@/services/supplier.service';
import { warehouseService } from '@/services/warehouse.service';
import { formatCurrency, formatDateTime, getPurchaseStatusColor } from '@/lib/utils';
import { Spinner } from '@/components/ui';

interface Props {
  purchaseOrderId: string;
  onClose: () => void;
}

export function PurchaseOrderDetailsModal({ purchaseOrderId, onClose }: Props) {
  
  // 1. Lấy chi tiết phiếu nhập
  const { data: po, isLoading: loadingPo } = useQuery({
    queryKey: ['po-detail', purchaseOrderId],
    queryFn: () => purchaseService.getById(purchaseOrderId).then(r => r.data.data),
    enabled: !!purchaseOrderId,
  });

  // 2. Lấy danh sách Sản phẩm để map tên
  const { data: products } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  // 3. Lấy danh sách Nhà cung cấp để map tên
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll().then(r => r.data.data.content),
  });

  // 4. Lấy danh sách Chi nhánh để map tên
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  // --- MAP DỮ LIỆU ---
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
    warehouses?.forEach(w => map.set(w.id, w.name));
    return map;
  }, [warehouses]);


  if (loadingPo || !po) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Spinner size="lg" className="text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Chi tiết Phiếu nhập: <span className="text-primary-600">{po.code}</span></h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getPurchaseStatusColor(po.status)}`}>
              {po.status}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Cột trái: Thông tin phiếu */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Info className="w-4 h-4 text-blue-500" /> Thông tin chung
              </h3>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3"/> Nhà cung cấp</p>
                <p className="font-medium text-gray-800">{supplierMap.get(po.supplierId) || po.supplierId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Store className="w-3 h-3"/> Nhập tại chi nhánh</p>
                <p className="font-medium text-gray-800">{warehouseMap.get(po.warehouseId) || po.warehouseId}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Clock className="w-4 h-4 text-amber-500" /> Thời gian
              </h3>
              <div>
                <p className="text-xs text-gray-500">Ngày tạo phiếu</p>
                <p className="text-sm font-medium">{formatDateTime(po.createdAt)}</p>
              </div>
              {po.approvedAt && (
                <div>
                  <p className="text-xs text-gray-500">Ngày duyệt (Hoàn tất)</p>
                  <p className="text-sm font-medium text-green-600">{formatDateTime(po.approvedAt)}</p>
                </div>
              )}
            </div>

            {po.note && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                <h3 className="font-semibold text-amber-800 text-sm mb-1">Ghi chú / Lý do:</h3>
                <p className="text-sm text-amber-900 italic">{po.note}</p>
              </div>
            )}
          </div>

          {/* Cột phải: Danh sách hàng hóa */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" /> Danh sách hàng hóa ({po.items?.length || 0})
              </h3>
            </div>
            
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3 text-center">Số lượng</th>
                    <th className="p-3 text-right">Giá nhập</th>
                    <th className="p-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(po.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">Không có sản phẩm nào trong phiếu này.</td>
                    </tr>
                  ) : (
                    po.items.map((item: any) => {
                      const productInfo = productMap.get(item.productId);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <p className="font-medium text-gray-800">{productInfo?.name || 'Đang tải...'}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{productInfo?.isbnBarcode || item.productId.slice(0,8)}</p>
                          </td>
                          <td className="p-3 text-center font-semibold text-gray-700">
                            {item.quantity}
                          </td>
                          <td className="p-3 text-right text-gray-600">
                            {formatCurrency(item.importPrice)}
                          </td>
                          <td className="p-3 text-right font-bold text-primary-600">
                            {formatCurrency(item.quantity * item.importPrice)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Tổng tiền */}
            <div className="mt-4 bg-primary-50 border border-primary-100 rounded-xl p-4 flex justify-between items-center">
              <span className="font-medium text-primary-800">TỔNG CỘNG:</span>
              <span className="text-2xl font-bold text-primary-700">{formatCurrency(po.totalAmount)}</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end shrink-0">
          <button onClick={onClose} className="btn-secondary px-6">Đóng</button>
        </div>

      </div>
    </div>
  );
}