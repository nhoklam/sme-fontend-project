import React, { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Package, Info, Clock, MapPin, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { transferService } from '@/services/transfer.service';
import { warehouseService } from '@/services/warehouse.service';
import { productService } from '@/services/product.service';
import { formatDateTime } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { TransferPrintTemplate } from './TransferPrintTemplate';

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
    warehouses?.forEach(w => map.set(w.id, w.name));
    return map;
  }, [warehouses]);

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    products?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [products]);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600', 
    DISPATCHED: 'bg-amber-100 text-amber-700',
    RECEIVED: 'bg-green-100 text-green-700', 
    CANCELLED: 'bg-red-100 text-red-700',
  };

  if (isLoading || !transfer) {
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
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Chi tiết phiếu: <span className="text-primary-600">{transfer.code}</span></h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[transfer.status]}`}>
              {transfer.status}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* THÊM NÚT IN PHIẾU Ở ĐÂY */}
            <button 
              onClick={() => handlePrint()} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Printer className="w-4 h-4" /> In phiếu
            </button>
            
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Cột trái: Thông tin Tracking & Ghi chú */}
          <div className="md:col-span-1 space-y-5">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <MapPin className="w-4 h-4 text-blue-500" /> Tuyến đường
              </h3>
              <div>
                <p className="text-xs text-gray-500">Từ kho (Xuất)</p>
                <p className="font-medium text-gray-800">{warehouseMap.get(transfer.fromWarehouseId) || transfer.fromWarehouseId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Đến kho (Nhập)</p>
                <p className="font-medium text-gray-800">{warehouseMap.get(transfer.toWarehouseId) || transfer.toWarehouseId}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <Clock className="w-4 h-4 text-amber-500" /> Thời gian (Tracking)
              </h3>
              <div>
                <p className="text-xs text-gray-500">Ngày tạo phiếu</p>
                <p className="text-sm">{formatDateTime(transfer.createdAt)}</p>
              </div>
              {transfer.dispatchedAt && (
                <div>
                  <p className="text-xs text-gray-500">Thời gian xuất kho</p>
                  <p className="text-sm font-medium text-amber-600">{formatDateTime(transfer.dispatchedAt)}</p>
                </div>
              )}
              {transfer.receivedAt && (
                <div>
                  <p className="text-xs text-gray-500">Thời gian nhận hàng</p>
                  <p className="text-sm font-medium text-green-600">{formatDateTime(transfer.receivedAt)}</p>
                </div>
              )}
            </div>

            {transfer.note && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4" /> Ghi chú
                </h3>
                <p className="text-sm text-blue-900 italic">{transfer.note}</p>
              </div>
            )}
          </div>

          {/* Cột phải: Danh sách hàng hóa */}
          <div className="md:col-span-2 flex flex-col">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-gray-500" /> Chi tiết hàng hóa ({transfer.items.length})
            </h3>
            <div className="border rounded-xl overflow-hidden shadow-sm flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3 text-center">Số lượng gửi</th>
                    <th className="p-3 text-center">Thực nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfer.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-800">{productMap.get(item.productId) || 'Đang tải tên...'}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{item.productId.slice(0, 8)}...</p>
                      </td>
                      <td className="p-3 text-center font-semibold text-gray-700">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {transfer.status === 'RECEIVED' ? (
                          <span className={item.receivedQty < item.quantity ? 'text-red-500' : 'text-green-600'}>
                            {item.receivedQty}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Chờ...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end shrink-0">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
        </div>

        {/* === THÊM COMPONENT ẨN ĐỂ IN VÀO ĐÂY === */}
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
  );
}