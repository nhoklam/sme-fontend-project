import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Plus, Trash2, ShoppingBag, MapPin, CreditCard, User } from 'lucide-react';
import { orderService } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
import { productService } from '@/services/product.service';
import { inventoryService } from '@/services/inventory.service'; // Bổ sung import này
import { formatCurrency } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { CreateOrderRequest } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateOrderModal({ onClose, onSaved }: Props) {
  const { user, isAdmin } = useAuthStore();

  const [form, setForm] = useState<Partial<CreateOrderRequest>>({
    customerId: '',
    type: 'DELIVERY',
    shippingName: '',
    shippingPhone: '',
    shippingAddress: '',
    provinceCode: '',
    paymentMethod: 'COD',
    note: '',
  });

  const [items, setItems] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([]);

  // Lấy danh sách Khách hàng
  const { data: customers } = useQuery({
    queryKey: ['customers-dict'],
    queryFn: () => customerService.getAll({ size: 1000 }).then(r => r.data.data.content),
  });

  // Lấy danh sách Sản phẩm gốc
  const { data: productsData } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  // BỔ SUNG: Lấy tồn kho của Manager (Nếu đang đăng nhập bằng quyền Manager)
  const { data: managerInventory } = useQuery({
    queryKey: ['inventory', user?.warehouseId],
    queryFn: () => inventoryService.getByWarehouse(user?.warehouseId!).then((r: any) => r.data.data),
    enabled: !isAdmin() && !!user?.warehouseId,
  });

  // BỔ SUNG: Lọc danh sách sản phẩm hiển thị dựa trên Quyền và Tồn kho
  const availableProducts = useMemo(() => {
    if (!productsData) return [];

    if (!isAdmin() && managerInventory) {
      // Role Manager: Chỉ hiển thị SP có tồn kho > 0 tại chi nhánh của họ
      return productsData
        .map((p: any) => {
          const inv = managerInventory.find((i: any) => i.productId === p.id);
          return { ...p, displayQuantity: inv?.availableQuantity || 0 };
        })
        .filter((p: any) => p.displayQuantity > 0);
    }

    // Role Admin: Hiển thị SP có tồn kho tổng > 0 (Thuật toán Smart Routing sẽ tự tìm kho chốt đơn)
    return productsData
      .map((p: any) => ({ ...p, displayQuantity: p.availableQuantity || 0 }))
      .filter((p: any) => p.displayQuantity > 0);
  }, [productsData, managerInventory, isAdmin]);

  // Tự động điền thông tin giao hàng khi chọn khách hàng
  const handleCustomerChange = (customerId: string) => {
    const selectedCustomer = customers?.find((c: any) => c.id === customerId);
    setForm(prev => ({
      ...prev,
      customerId,
      shippingName: selectedCustomer?.fullName || '',
      shippingPhone: selectedCustomer?.phoneNumber || '',
      shippingAddress: selectedCustomer?.address || '',
    }));
  };

  const createMut = useMutation({
    mutationFn: () => {
      const payload: CreateOrderRequest = {
        customerId: form.customerId!,
        type: form.type!,
        shippingName: form.shippingName!,
        shippingPhone: form.shippingPhone!,
        shippingAddress: form.shippingAddress!,
        provinceCode: form.provinceCode!,
        paymentMethod: form.paymentMethod!,
        note: form.note,
        // Nếu là Admin thì để undefined cho phép thuật toán Smart Routing tự chạy
        // Nếu là Manager thì ép cứng đơn hàng thuộc về kho của họ
        assignedWarehouseId: isAdmin() ? undefined : user?.warehouseId, 
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      };
      return orderService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(`Tạo đơn hàng thành công! Mã đơn: ${res.data.data.code}`);
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo đơn hàng'),
  });

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'productId') {
      const selectedProduct = availableProducts.find((p: any) => p.id === value);
      newItems[index] = { 
        ...newItems[index], 
        productId: value,
        unitPrice: selectedProduct?.retailPrice || 0,
        quantity: 1 // Tự động reset số lượng về 1 khi chọn SP mới để tránh lỗi vượt tồn kho
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const isValid = form.customerId && form.shippingName && form.shippingPhone && form.shippingAddress && form.provinceCode &&
                  items.length > 0 && items.every(i => i.productId && i.quantity > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0 bg-blue-600 text-white rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Tạo đơn hàng mới (Telesale)</h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-gray-50 grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* CỘT TRÁI: THÔNG TIN KHÁCH HÀNG & GIAO HÀNG */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <User className="w-4 h-4 text-blue-500" /> Thông tin Khách hàng
              </h3>
              
              <div>
                <label className="label">Chọn Khách hàng <span className="text-red-500">*</span></label>
                <select className="input" value={form.customerId} onChange={e => handleCustomerChange(e.target.value)}>
                  <option value="">-- Tìm và chọn khách hàng --</option>
                  {customers?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.fullName} - {c.phoneNumber}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Lưu ý: Phải tạo khách hàng trong menu Khách hàng trước khi lên đơn.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <MapPin className="w-4 h-4 text-orange-500" /> Thông tin Giao hàng
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Loại đơn <span className="text-red-500">*</span></label>
                  <select className="input font-bold text-primary-700" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="DELIVERY">Giao tận nơi (DELIVERY)</option>
                    <option value="BOPIS">Nhận tại quầy (BOPIS)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Mã Tỉnh/Thành phố <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="VD: 79 (TP.HCM)" value={form.provinceCode} onChange={e => setForm({ ...form, provinceCode: e.target.value })} />
                  <p className="text-[10px] text-gray-400 mt-1">Hệ thống dựa vào mã này để định tuyến kho tự động.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Người nhận <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="Tên người nhận..." value={form.shippingName} onChange={e => setForm({ ...form, shippingName: e.target.value })} />
                </div>
                <div>
                  <label className="label">SĐT nhận hàng <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="Số điện thoại..." value={form.shippingPhone} onChange={e => setForm({ ...form, shippingPhone: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label">Địa chỉ chi tiết <span className="text-red-500">*</span></label>
                <textarea className="input resize-none" rows={2} placeholder="Số nhà, đường, phường/xã..." value={form.shippingAddress} onChange={e => setForm({ ...form, shippingAddress: e.target.value })} />
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: SẢN PHẨM & THANH TOÁN */}
          <div className="space-y-4 flex flex-col">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
              <div className="flex justify-between items-center border-b pb-2 mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-green-500" /> Giỏ hàng
                </h3>
                <button type="button" onClick={handleAddItem} className="btn-secondary btn-sm">
                  <Plus className="w-4 h-4 mr-1" /> Thêm SP
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] custom-scrollbar pr-2">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    Chưa có sản phẩm nào. Bấm "Thêm SP" để bắt đầu.
                  </div>
                ) : (
                  items.map((item, index) => {
                    const maxQty = availableProducts.find(p => p.id === item.productId)?.displayQuantity || 9999;
                    return (
                      <div key={index} className="flex flex-wrap gap-2 items-end bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-[150px]">
                          <label className="label text-xs">Sản phẩm</label>
                          <select className="input py-1.5 text-sm" value={item.productId} onChange={e => handleUpdateItem(index, 'productId', e.target.value)}>
                            <option value="">-- Chọn --</option>
                            {availableProducts.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name} (Tồn: {p.displayQuantity})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-20">
                          <label className="label text-xs">SL</label>
                          {/* ĐÃ BỔ SUNG THUỘC TÍNH max ĐỂ CHẶN NGƯỜI DÙNG NHẬP QUÁ TỒN KHO */}
                          <input 
                            type="number" 
                            min={1} 
                            max={maxQty} 
                            className="input py-1.5 text-sm text-center" 
                            value={item.quantity || ''} 
                            onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)} 
                          />
                        </div>
                        <div className="w-24">
                          <label className="label text-xs">Đơn giá</label>
                          <div className="py-1.5 text-sm font-semibold text-gray-600 text-right">{formatCurrency(item.unitPrice)}</div>
                        </div>
                        <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg mb-0.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* TỔNG TIỀN */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
                  <span className="font-semibold text-green-800">TỔNG CỘNG:</span>
                  <span className="text-xl font-bold text-green-700">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2">
                <CreditCard className="w-4 h-4 text-purple-500" /> Thanh toán & Ghi chú
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Hình thức TT</label>
                  <select className="input" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                    <option value="COD">Thanh toán khi nhận (COD)</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                    <option value="CASH">Tiền mặt tại quầy</option>
                  </select>
                </div>
                <div>
                  <label className="label">Ghi chú đơn hàng</label>
                  <textarea className="input resize-none" rows={1} placeholder="Ghi chú cho vận chuyển..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="p-5 border-t bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-6">Hủy bỏ</button>
          <button 
            onClick={() => createMut.mutate()} 
            disabled={!isValid || createMut.isPending}
            className="btn-primary px-6"
          >
            {createMut.isPending ? <Spinner size="sm" /> : 'Xác nhận tạo đơn'}
          </button>
        </div>

      </div>
    </div>
  );
}