import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, SlidersHorizontal, MapPin } from 'lucide-react';
import { inventoryService } from '../services/inventory.service';
import { warehouseService } from '../services/warehouse.service';
import { useAuthStore } from '../stores/auth.store';
import { Spinner } from '../components/ui';
import toast from 'react-hot-toast';

interface Props {
  inventory?: any;
  product?: any; 
  onClose: () => void;
  onSuccess?: () => void; 
}

export default function InventoryAdjustModal({ inventory, product, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(!isAdmin() ? (user?.warehouseId || '') : (inventory?.warehouseId || ''));
  const targetProductId = inventory?.productId || product?.id;

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
    enabled: isAdmin(),
  });

  // Lấy dữ liệu tồn kho mới nhất từ API (đã sửa lỗi 404)
  const { data: invData, isLoading: loadingInv } = useQuery({
    queryKey: ['inventory-single', targetProductId, selectedWarehouseId],
    queryFn: () => inventoryService.getOne(targetProductId, selectedWarehouseId).then((r: any) => r.data.data),
    enabled: !!selectedWarehouseId && !!targetProductId,
  });

  const currentQty = invData?.quantity ?? 0;
  const targetName = invData?.productName || inventory?.productName || product?.name || 'Đang tải...';
  
  const [actualQuantity, setActualQuantity] = useState<number | string>('');
  const [reason, setReason] = useState<string>('');

  const adjustMut = useMutation({
    mutationFn: () => inventoryService.adjust({
      productId: targetProductId,
      warehouseId: selectedWarehouseId,
      actualQuantity: Number(actualQuantity) || 0,
      reason: reason
    }),
    onSuccess: () => {
      toast.success('Điều chỉnh tồn kho thành công!');
      qc.invalidateQueries({ queryKey: ['inventory-search'] });
      qc.invalidateQueries({ queryKey: ['products'] }); 
      if (onSuccess) onSuccess(); 
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi điều chỉnh tồn kho'),
  });

  const diff = (Number(actualQuantity) || 0) - currentQty;

  if (!inventory && !product) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><SlidersHorizontal className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-gray-800">Kiểm kê / Điều chỉnh kho</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Sản phẩm</p>
            <p className="font-semibold text-gray-800">{targetName}</p>
          </div>

          <div>
            <label className="text-sm text-gray-500 font-medium mb-1 block">Xử lý tại chi nhánh</label>
            {isAdmin() ? (
                <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select className="input pl-9" value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
                        <option value="">-- Chọn kho cần xử lý --</option>
                        {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            ) : (
                <div className="input bg-gray-100 text-gray-600 cursor-not-allowed">{user?.warehouseName}</div>
            )}
          </div>

          {selectedWarehouseId && !loadingInv && (
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
          )}

          <div>
            <label className="label">Tồn kho thực tế (Sau kiểm đếm) <span className="text-red-500">*</span></label>
            <input type="number" min={0} className="input text-lg font-bold py-3 text-center" placeholder={currentQty.toString()} value={actualQuantity} onChange={e => setActualQuantity(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="label">Lý do điều chỉnh <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Ví dụ: Cập nhật tồn kho đầu kỳ, hàng hỏng..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-6">Hủy</button>
          <button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending || !selectedWarehouseId || actualQuantity === '' || Number(actualQuantity) < 0 || !reason.trim() || diff === 0} className="btn-primary px-6 bg-amber-600 hover:bg-amber-700 border-none shadow-md shadow-amber-200">
            {adjustMut.isPending ? <Spinner size="sm" /> : 'Xác nhận lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}