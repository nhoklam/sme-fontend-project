import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Package, ScanLine, Info } from 'lucide-react';
import { inventoryService } from '../services/inventory.service';
import { productService } from '../services/product.service';
import { Spinner } from '../components/ui';

interface Props {
  products: any[]; // Giữ lại interface để không lỗi các component gọi nó, nhưng sẽ fetch lại từ API
  selectedWarehouseId: string;
  onClose: () => void;
}

export function InventoryQuickLookupModal({ selectedWarehouseId, onClose }: Props) {
  const wid = selectedWarehouseId;
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Tải danh sách sản phẩm nhẹ để làm dropdown
  const { data: productsData } = useQuery({
    queryKey: ['products-dict-lookup'],
    queryFn: () => productService.getProducts({ size: 1000 }).then((r: any) => r.data.data.content),
  });

  const { data: invData, isLoading } = useQuery({
    queryKey: ['inventory-single', selectedProductId, wid],
    queryFn: () => inventoryService.getOne(selectedProductId, wid).then((r: any) => r.data.data),
    enabled: !!selectedProductId && !!wid,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b bg-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><ScanLine className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-gray-800">Tra cứu nhanh tồn kho</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="label">Chọn hoặc gõ tên sản phẩm cần tra cứu:</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select 
                className="input pl-10 py-3 text-base font-medium"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Chọn sản phẩm --</option>
                {productsData?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.isbnBarcode ? `[${p.isbnBarcode}] ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedProductId && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                  <Spinner size="md" />
                  <p className="mt-3 text-sm">Đang truy vấn máy chủ...</p>
                </div>
              ) : invData && (
                <div className="space-y-4">
                  <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
                    <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                      {invData.productImageUrl ? (
                        <img src={invData.productImageUrl} alt="img" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg leading-tight">{invData.productName}</h4>
                      <p className="text-sm text-gray-500 mt-1 font-mono">Barcode: {invData.isbnBarcode || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm text-center">
                      <p className="text-xs text-gray-500 font-medium mb-1">Tồn kho vật lý</p>
                      <p className="text-2xl font-black text-gray-800">{invData.quantity}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm text-center">
                      <p className="text-xs text-green-600 font-medium mb-1">Có thể bán</p>
                      <p className="text-2xl font-black text-green-700">{invData.availableQuantity}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm text-center">
                      <p className="text-xs text-amber-600 font-medium mb-1">Giữ chỗ</p>
                      <p className="text-xl font-bold text-amber-700">{invData.reservedQuantity}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                      <p className="text-xs text-blue-600 font-medium mb-1">Đang về</p>
                      <p className="text-xl font-bold text-blue-700">{invData.inTransit}</p>
                    </div>
                  </div>
                  
                  {invData.lowStock && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2.5 rounded-lg text-sm font-medium border border-red-100">
                      <Info className="w-4 h-4" /> Sản phẩm này đang chạm mức báo động (Sắp hết hàng).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}