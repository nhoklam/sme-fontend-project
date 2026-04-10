import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Trash2, Package } from 'lucide-react';
// ĐÃ SỬA: Dùng đường dẫn tương đối ../ thay vì @/
import { supplierService } from '../services/supplier.service';
import { warehouseService } from '../services/warehouse.service';
import { productService } from '../services/product.service';
import { purchaseService } from '../services/purchase.service';
import { useAuthStore } from '../stores/auth.store';
import { Spinner } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreatePurchaseOrderModal({ onClose, onSaved }: Props) {
  const { user, isAdmin } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: !isAdmin() ? (user?.warehouseId || '') : '',
    note: '',
  });

  const [items, setItems] = useState<Array<{ productId: string; quantity: number; importPrice: number }>>([]);

  // ĐÃ SỬA: Thêm (r: any)
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-po'],
    queryFn: () => supplierService.getAll({ size: 1000 }).then((r: any) => r.data.data.content),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-po'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
    enabled: isAdmin(), 
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-po'],
    queryFn: () => productService.getProducts({ size: 1000 }).then((r: any) => r.data.data.content),
  });

  const filteredProducts = useMemo(() => {
    if (!form.supplierId) return []; 
    return productsData?.filter((p: any) => p.supplierId === form.supplierId) || [];
  }, [productsData, form.supplierId]);

  useEffect(() => {
    setItems([]);
  }, [form.supplierId]);

  const createMut = useMutation({
    mutationFn: () => purchaseService.create({
      supplierId: form.supplierId,
      warehouseId: form.warehouseId,
      note: form.note,
      items: items
    }),
    onSuccess: () => {
      toast.success('Tạo phiếu nhập kho thành công! Phiếu đang chờ duyệt.');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo phiếu nhập kho'),
  });

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1, importPrice: 0 }]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    
    if (field === 'productId') {
      const selectedProduct = filteredProducts?.find((p: any) => p.id === value);
      newItems[index] = { 
        ...newItems[index], 
        productId: value,
        importPrice: selectedProduct?.macPrice || 0 
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.importPrice), 0);

  const isValid = form.supplierId && form.warehouseId && 
                  items.length > 0 && 
                  items.every(i => i.productId && i.quantity > 0 && i.importPrice > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0 bg-blue-600 text-white rounded-t-2xl">
          <h2 className="text-xl font-bold">Tạo Phiếu Nhập Kho Mới</h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-gray-50">
          
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nhà cung cấp <span className="text-red-500">*</span></label>
                <select 
                  className="input" 
                  value={form.supplierId} 
                  onChange={e => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">-- Chọn Nhà cung cấp --</option>
                  {suppliers?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} {s.taxCode ? `(MST: ${s.taxCode})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Nhập tại Chi nhánh <span className="text-red-500">*</span></label>
                {isAdmin() ? (
                  <select 
                    className="input" 
                    value={form.warehouseId} 
                    onChange={e => setForm({ ...form, warehouseId: e.target.value })}
                  >
                    <option value="">-- Chọn Chi nhánh --</option>
                    {warehouses?.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                ) : (
                  <select className="input bg-gray-100 cursor-not-allowed" disabled value={form.warehouseId}>
                    <option value={form.warehouseId}>{user?.warehouseName}</option>
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="label">Ghi chú phiếu nhập</label>
              <textarea 
                className="input resize-none" rows={2} 
                placeholder="Ví dụ: Nhập hàng đợt 1 tháng 10..."
                value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" /> Danh sách hàng nhập
              </h3>
              {form.supplierId && filteredProducts.length > 0 && (
                <button type="button" onClick={handleAddItem} className="btn-secondary btn-sm">
                  <Plus className="w-4 h-4 mr-1" /> Thêm sản phẩm
                </button>
              )}
            </div>

            {!form.supplierId ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Vui lòng chọn Nhà cung cấp ở trên để xem danh sách sản phẩm.
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border border-dashed border-amber-200 flex flex-col items-center gap-3">
                <Package className="w-10 h-10 opacity-50" />
                <div>
                  <p className="font-bold text-lg">Chưa có sản phẩm nào!</p>
                  <p className="text-sm opacity-80 mt-1 max-w-md">
                    Hệ thống không tìm thấy sản phẩm nào thuộc Nhà cung cấp này. Bạn cần khai báo danh mục sản phẩm trước khi nhập hàng.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    onClose(); 
                    navigate('/products');
                  }}
                  className="btn-primary mt-2 shadow-md shadow-amber-200/50"
                >
                  <Plus className="w-4 h-4 mr-1" /> Đi tới Quản lý Sản phẩm
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Chưa có sản phẩm nào trong phiếu. Bấm "Thêm sản phẩm" để bắt đầu.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-[200px]">
                      <label className="label text-xs">Sản phẩm</label>
                      <select 
                        className="input py-1.5 text-sm"
                        value={item.productId}
                        onChange={e => handleUpdateItem(index, 'productId', e.target.value)}
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {filteredProducts?.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="label text-xs">Số lượng</label>
                      <input 
                        type="number" min={1}
                        className="input py-1.5 text-sm font-semibold text-center"
                        value={item.quantity || ''}
                        onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-40">
                      <label className="label text-xs">Giá nhập (VNĐ)</label>
                      <input 
                        type="number" min={1}
                        className="input py-1.5 text-sm font-semibold text-right"
                        value={item.importPrice || ''}
                        onChange={e => handleUpdateItem(index, 'importPrice', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-32 hidden md:block">
                      <label className="label text-xs">Thành tiền</label>
                      <div className="py-1.5 text-sm font-bold text-primary-600 text-right">
                        {formatCurrency(item.quantity * item.importPrice)}
                      </div>
                    </div>
                    <div className="pb-1">
                      <button 
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="flex justify-end pt-4 border-t mt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Tổng tiền dự kiến</p>
                  <p className="text-2xl font-bold text-primary-600">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-6">Hủy bỏ</button>
          <button 
            onClick={() => createMut.mutate()} 
            disabled={!isValid || createMut.isPending}
            className="btn-primary px-6"
          >
            {createMut.isPending ? <Spinner size="sm" /> : 'Xác nhận tạo phiếu (Chờ duyệt)'}
          </button>
        </div>

      </div>
    </div>
  );
}