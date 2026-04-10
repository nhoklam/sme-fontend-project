import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, SlidersHorizontal } from 'lucide-react';
import { inventoryService } from '../services/inventory.service';
import { Spinner } from '../components/ui';
import toast from 'react-hot-toast';

interface Props {
  inventory?: any;
  product?: any; // Hỗ trợ nhận prop 'product' từ trang ProductsPage
  onClose: () => void;
  onSuccess?: () => void; // Hỗ trợ nhận hàm onSuccess
}

export function InventoryAdjustModal({ inventory, product, onClose, onSuccess }: Props) {
  const qc = useQueryClient();

  // Bắt lỗi an toàn: Lấy dữ liệu từ 'inventory' hoặc 'product' tùy xem trang nào gọi nó
  const currentQty = inventory?.quantity ?? product?.availableQuantity ?? 0;
  const targetName = inventory?.product?.name || product?.name || 'Sản phẩm không xác định';
  const targetProductId = inventory?.productId || product?.id;
  const targetWarehouseId = inventory?.warehouseId || '';

  const [actualQuantity, setActualQuantity] = useState<number>(currentQty);
  const [reason, setReason] = useState<string>('');

  const adjustMut = useMutation({
    mutationFn: () => inventoryService.adjust({
      productId: targetProductId,
      warehouseId: targetWarehouseId,
      actualQuantity: actualQuantity,
      reason: reason
    }),
    onSuccess: () => {
      toast.success('Điều chỉnh tồn kho thành công!');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['products'] }); // Refresh cả trang sản phẩm
      if (onSuccess) onSuccess(); // Gọi onSuccess nếu trang cha có truyền
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi điều chỉnh tồn kho'),
  });

  const diff = actualQuantity - currentQty;

  // Nếu cả inventory và product đều undefined (chưa render kịp) thì không hiện modal
  if (!inventory && !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Kiểm kê / Điều chỉnh</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Sản phẩm</p>
            <p className="font-semibold text-gray-800">{targetName}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="text-xs text-gray-500 font-medium">Tồn kho hệ thống</label>
              <div className="text-xl font-bold text-gray-700 mt-1">{currentQty}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Độ chênh lệch</label>
              <div className={`text-xl font-bold mt-1 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {diff > 0 ? `+${diff}` : diff}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Tồn kho thực tế (Kiểm đếm) <span className="text-red-500">*</span></label>
            <input 
              type="number" min={0} 
              className="input text-lg font-bold py-3" 
              value={actualQuantity} 
              onChange={e => setActualQuantity(parseInt(e.target.value) || 0)} 
            />
          </div>

          <div>
            <label className="label">Lý do điều chỉnh <span className="text-red-500">*</span></label>
            <textarea 
              className="input resize-none" rows={3} 
              placeholder="Ví dụ: Hàng hỏng, thất thoát, sai số liệu..."
              value={reason} onChange={e => setReason(e.target.value)} 
            />
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-6">Hủy</button>
          <button 
            onClick={() => adjustMut.mutate()} 
            disabled={adjustMut.isPending || actualQuantity < 0 || !reason.trim() || diff === 0}
            className="btn-primary px-6 bg-amber-600 hover:bg-amber-700 border-none"
          >
            {adjustMut.isPending ? <Spinner size="sm" /> : 'Xác nhận thay đổi'}
          </button>
        </div>

      </div>
    </div>
  );
}

// Bắt buộc phải có dòng này để ProductsPage có thể import theo kiểu default
export default InventoryAdjustModal;