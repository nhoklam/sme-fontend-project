import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { warehouseService } from '@/services/warehouse.service';
import { inventoryService } from '@/services/inventory.service';
import { productService } from '@/services/product.service';
import { transferService } from '@/services/transfer.service';
import { useAuthStore } from '@/stores/auth.store';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

interface Props {
  transferId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransferModal({ transferId, onClose, onSaved }: Props) {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  
  const [form, setForm] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    note: '',
  });
  const [items, setItems] = useState<Array<{ productId: string; quantity: number }>>([]);

  const { data: transfer, isLoading: loadingTransfer } = useQuery({
    queryKey: ['transfer-detail', transferId], 
    queryFn: () => transferService.getById(transferId).then(r => r.data.data),
    enabled: !!transferId,
  });

  useEffect(() => {
    if (transfer) {
      setForm({
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        note: transfer.note || '',
      });
      setItems(transfer.items.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity
      })));
    }
  }, [transfer]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-transfer'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-lookup'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    productsData?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [productsData]);

  const { data: sourceInventory, isLoading: loadingInv } = useQuery({
    queryKey: ['inventory', form.fromWarehouseId],
    queryFn: () => inventoryService.getByWarehouse(form.fromWarehouseId).then(r => r.data.data),
    enabled: !!form.fromWarehouseId,
  });

  const updateMut = useMutation({
    mutationFn: () => transferService.update(transferId, {
      toWarehouseId: form.toWarehouseId,
      note: form.note,
      items: items
    }),
    // ĐÃ SỬA: Thêm async và dùng await refetchQueries
    onSuccess: async () => {
      toast.success('Cập nhật phiếu chuyển kho thành công!');
      
      // ÉP BUỘC TẢI LẠI VÀ CHỜ KẾT QUẢ RỒI MỚI CHẠY TIẾP
      await qc.refetchQueries({ queryKey: ['transfers'] });
      await qc.refetchQueries({ queryKey: ['transfer-detail', transferId] });
      
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật phiếu chuyển kho'),
  });

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1 }]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const isValid = form.fromWarehouseId && form.toWarehouseId && form.fromWarehouseId !== form.toWarehouseId &&
                  items.length > 0 && items.every(i => i.productId && i.quantity > 0);

  if (loadingTransfer) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><Spinner size="lg" className="text-white" /></div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Sửa phiếu Nháp: {transfer?.code}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Từ kho (Xuất) <span className="text-gray-400 text-xs">- Cố định</span></label>
              <select className="input bg-gray-100 cursor-not-allowed" value={form.fromWarehouseId} disabled>
                <option value={form.fromWarehouseId}>
                  {warehouses?.find(w => w.id === form.fromWarehouseId)?.name || form.fromWarehouseId}
                </option>
              </select>
            </div>
            <div>
              <label className="label">Đến kho (Nhập) <span className="text-red-500">*</span></label>
              <select 
                className="input" 
                value={form.toWarehouseId} 
                onChange={e => setForm({ ...form, toWarehouseId: e.target.value })}
              >
                <option value="">-- Chọn kho nhập --</option>
                {warehouses?.map(w => (
                  <option key={w.id} value={w.id} disabled={w.id === form.fromWarehouseId}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Ghi chú điều chuyển</label>
            <textarea 
              className="input resize-none" rows={2} 
              placeholder="Nhập lý do hoặc ghi chú..."
              value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4" /> Danh sách hàng chuyển
              </h3>
              <button 
                type="button" 
                onClick={handleAddItem}
                disabled={loadingInv}
                className="btn-secondary btn-sm"
              >
                <Plus className="w-4 h-4 mr-1" /> Thêm sản phẩm
              </button>
            </div>

            {items.map((item, index) => {
              const invRecord = sourceInventory?.find((inv: any) => inv.productId === item.productId);
              const originalItem = transfer?.items.find((i: any) => i.productId === item.productId);
              const maxQty = (invRecord?.availableQuantity || 0) + (originalItem?.quantity || 0);

              return (
                <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <label className="label text-xs">Sản phẩm</label>
                    <select 
                      className="input py-1.5 text-sm"
                      value={item.productId}
                      onChange={e => handleUpdateItem(index, 'productId', e.target.value)}
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {sourceInventory?.filter((inv: any) => inv.availableQuantity > 0 || inv.productId === item.productId).map((inv: any) => (
                        <option key={inv.productId} value={inv.productId}>
                          {productMap.get(inv.productId) || inv.productId} (Tồn khả dụng: {(inv.availableQuantity || 0) + (transfer?.items.find((i:any) => i.productId === inv.productId)?.quantity || 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="label text-xs">Số lượng</label>
                    <input 
                      type="number" min={1} max={maxQty}
                      className="input py-1.5 text-sm"
                      value={item.quantity}
                      onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="pt-6">
                    <button 
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">Hủy bỏ</button>
          <button 
            onClick={() => updateMut.mutate()} 
            disabled={!isValid || updateMut.isPending}
            className="btn-primary flex items-center justify-center min-w-[120px]"
          >
            {updateMut.isPending ? <Spinner size="sm" className="text-white" /> : 'Lưu thay đổi'}
          </button>
        </div>

      </div>
    </div>
  );
}