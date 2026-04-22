import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Plus, Trash2, ShoppingBag, MapPin, CreditCard, User, Lightbulb, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'; 
import AsyncSelect from 'react-select/async'; 
import { orderService } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
import { productService } from '@/services/product.service';
import { inventoryService } from '@/services/inventory.service';
import { formatCurrency } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { CreateOrderRequest } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

// DANH SÁCH MÃ TỈNH THÀNH
const PROVINCES = [
  { code: '01', name: 'Hà Nội' }, { code: '79', name: 'Hồ Chí Minh' },
  { code: '31', name: 'Hải Phòng' }, { code: '48', name: 'Đà Nẵng' },
  { code: '92', name: 'Cần Thơ' }, { code: '10', name: 'Lào Cai' }
];

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateOrderModal({ onClose, onSaved }: Props) {
  const { user, isAdmin } = useAuthStore();

  const [form, setForm] = useState<Partial<CreateOrderRequest>>({
    customerId: '', type: 'DELIVERY', shippingName: '', shippingPhone: '',
    shippingAddress: '', provinceCode: '', paymentMethod: 'COD', note: '',
    assignedWarehouseId: !isAdmin() ? user?.warehouseId : undefined
  });

  const [items, setItems] = useState<Array<{ productId: string; quantity: number; unitPrice: number; productName: string }>>([]);
  const [currentCustomer, setCurrentCustomer] = useState<{value: string, label: string} | null>(null);

  // CONSOLIDATION PLAN STATE
  const [consolidationPlans, setConsolidationPlans] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // ĐÃ SỬA: GỌI API TỐI ƯU HƠN, KHÔNG GỌI KHI DÒNG TRỐNG
  useEffect(() => {
    const fetchSuggestions = async () => {
      // 1. Lọc ra những item ĐÃ CHỌN SẢN PHẨM và CÓ SỐ LƯỢNG
      const validItems = items.filter(i => i.productId && i.quantity > 0);

      // 2. Chặn gọi API nếu: Không phải admin, chưa chọn tỉnh, giỏ hàng trống, 
      // HOẶC đang có dòng trống chưa chọn SP (validItems.length !== items.length)
      if (!isAdmin() || !form.provinceCode || validItems.length === 0 || validItems.length !== items.length) {
        if (validItems.length === 0) {
          setConsolidationPlans([]); // Chỉ clear list khi xóa hết giỏ hàng
        }
        setSuggestError(null);
        return;
      }
      
      setIsSuggesting(true);
      setSuggestError(null);
      
      try {
        const payload = {
          provinceCode: form.provinceCode,
          items: validItems.map(item => ({ productId: item.productId, quantity: item.quantity }))
        };
        const response = await orderService.suggestBranch(payload);
        setConsolidationPlans(response.data?.data || []);
      } catch (error: any) { 
        console.error(error); 
        setConsolidationPlans([]);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
           setSuggestError('Máy chủ xử lý quá lâu. Có thể do đơn hàng quá lớn.');
        } else {
           setSuggestError('Có lỗi xảy ra khi tính toán điều phối kho.');
        }
      } finally { 
        setIsSuggesting(false); 
      }
    };
    
    const timeoutId = setTimeout(() => fetchSuggestions(), 800);
    return () => clearTimeout(timeoutId);
  }, [form.provinceCode, items, isAdmin]);

  const loadCustomerOptions = async (inputValue: string) => {
    try {
      const response = await customerService.getAll({ keyword: inputValue, size: 20 });
      const custs = response.data?.data?.content || []; 
      return custs.map((c: any) => ({ value: c.id, label: `${c.fullName} - ${c.phoneNumber}`, original: c }));
    } catch { return []; }
  };

  const handleCustomerChange = (selected: any) => {
    setCurrentCustomer(selected);
    if (selected?.original) {
      const cust = selected.original;
      setForm(prev => ({ ...prev, customerId: cust.id, shippingName: cust.fullName, shippingPhone: cust.phoneNumber, shippingAddress: cust.address }));
    } else {
      setForm(prev => ({ ...prev, customerId: '', shippingName: '', shippingPhone: '', shippingAddress: '' }));
    }
  };

  const { data: productsData } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data?.data?.content || []),
  });

  const { data: managerInventory } = useQuery({
    queryKey: ['inventory', user?.warehouseId],
    queryFn: () => inventoryService.searchInventory(user?.warehouseId!, { page: 0, size: 1000 }).then((r: any) => r.data?.data?.content || []),
    enabled: !isAdmin() && !!user?.warehouseId,
  });

  const availableProducts = useMemo(() => {
    if (!productsData || !Array.isArray(productsData)) return [];
    
    if (!isAdmin() && managerInventory && Array.isArray(managerInventory)) {
      return productsData
        .map((p: any) => {
          const inv = managerInventory.find((i: any) => i.productId === p.id);
          return { ...p, displayQuantity: inv?.availableQuantity || 0 };
        })
        .filter((p: any) => p.displayQuantity > 0);
    }
    
    return productsData
      .map((p: any) => ({ ...p, displayQuantity: p.availableQuantity || 0 }))
      .filter((p: any) => p.displayQuantity > 0);
  }, [productsData, managerInventory, isAdmin]);

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
        assignedWarehouseId: form.assignedWarehouseId, 
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      };
      return orderService.create(payload);
    },
    onSuccess: (res) => {
      toast.success(`Tạo đơn hàng thành công! Mã đơn: ${res.data?.data?.code || ''}`);
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo đơn hàng'),
  });

  const validateTotalStock = (): boolean => {
    const totalRequested = items.reduce((acc: Record<string, number>, item: any) => {
      if (!item.productId) return acc;
      acc[item.productId] = (acc[item.productId] || 0) + (Number(item.quantity) || 0);
      return acc;
    }, {});

    for (const [productId, totalQty] of Object.entries(totalRequested)) {
      const product = availableProducts.find((p: any) => p.id === productId);
      if (product && totalQty > product.displayQuantity) {
        toast.error(
          `Sản phẩm "${product.name}" không đủ tồn kho! Bạn đang đặt ${totalQty} nhưng hệ thống chỉ còn ${product.displayQuantity}.`,
          { duration: 5000 }
        );
        return false;
      }
    }
    return true;
  };

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0, productName: '' }]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'productId') {
      const selected = availableProducts.find((p: any) => p.id === value);
      newItems[index] = { 
        ...newItems[index], 
        productId: value, 
        unitPrice: selected?.retailPrice || 0, 
        productName: selected?.name || '', 
        quantity: 1 
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const isValid = form.customerId && form.shippingName && form.shippingPhone && form.shippingAddress && form.provinceCode &&
                  items.length > 0 && items.every(i => i.productId && i.quantity > 0) &&
                  (!isAdmin() || form.assignedWarehouseId);

  const handleSubmit = () => {
    if (!validateTotalStock()) return; 
    createMut.mutate();
  };

  // Đã check valid array
  const hasValidItems = items.length > 0 && items.some(i => i.productId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b bg-blue-600 text-white rounded-t-2xl shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Tạo đơn hàng (Auto-Routing)</h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-gray-50 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2"><User className="w-4 h-4 text-blue-500" /> Thông tin Khách hàng</h3>
              <AsyncSelect cacheOptions defaultOptions loadOptions={loadCustomerOptions} value={currentCustomer} onChange={handleCustomerChange} placeholder="Gõ tên hoặc SĐT..." className="text-sm font-medium"/>
              <input className="input" placeholder="Tên người nhận..." value={form.shippingName} onChange={e => setForm({ ...form, shippingName: e.target.value })} />
              <input className="input" placeholder="Số điện thoại..." value={form.shippingPhone} onChange={e => setForm({ ...form, shippingPhone: e.target.value })} />
              <textarea className="input resize-none" rows={2} placeholder="Địa chỉ chi tiết..." value={form.shippingAddress} onChange={e => setForm({ ...form, shippingAddress: e.target.value })} />
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 border-b pb-2"><CreditCard className="w-4 h-4 text-purple-500" /> Hình thức thanh toán</h3>
              <select className="input" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}><option value="COD">Thanh toán khi nhận (COD)</option><option value="BANK_TRANSFER">Chuyển khoản</option></select>
              <textarea className="input resize-none" rows={2} placeholder="Ghi chú đơn hàng..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="label">Hình thức</label><select className="input font-bold text-primary-700" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="DELIVERY">Giao hàng (DELIVERY)</option><option value="BOPIS">Nhận tại quầy (BOPIS)</option></select></div>
                <div><label className="label">Tỉnh / TP Giao hàng *</label><select className="input" value={form.provinceCode} onChange={e => setForm({ ...form, provinceCode: e.target.value })}><option value="">-- Chọn Tỉnh/TP --</option>{PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</select></div>
              </div>

              {/* ĐÃ SỬA: GIAO DIỆN HIỂN THỊ KẾ HOẠCH GOM HÀNG */}
              {isAdmin() && form.provinceCode && hasValidItems && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl min-h-[120px] transition-all">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" /> Kế hoạch Phân bổ Kho (Consolidation Plan)
                    {/* Giữ nguyên icon xoay bên cạnh thay vì xóa cả khối đi */}
                    {isSuggesting && <Spinner size="sm" className="ml-2 text-indigo-500" />}
                  </h4>
                  
                  {/* Bọc opacity lại để làm mờ nhẹ khi loading chứ không xóa bỏ */}
                  <div className={`transition-opacity duration-300 ${isSuggesting ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {suggestError ? (
                      <p className="text-sm text-red-600 font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {suggestError}</p>
                    ) : consolidationPlans.length > 0 ? (
                      <div className="space-y-3">
                        {consolidationPlans.map((plan: any) => {
                          const isSelected = form.assignedWarehouseId === plan.warehouseId;
                          return (
                            <div key={plan.warehouseId} onClick={() => setForm({ ...form, assignedWarehouseId: plan.warehouseId })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-white shadow-md' : 'border-slate-200 bg-white/50 hover:border-indigo-300'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-slate-900">{plan.warehouseName} {plan.isSameProvince && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded ml-2">Cùng Tỉnh</span>}</p>
                                {isSelected ? <CheckCircle2 className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300"/>}
                              </div>
                              {plan.isReadyToShip ? (
                                <p className="text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">✓ Kho đủ hàng. Giao ngay!</p>
                              ) : (
                                <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-100">
                                  <p className="font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Thiếu hàng. Tự động luân chuyển từ:</p>
                                  <ul className="list-disc ml-5 mt-1 opacity-90">
                                    {(plan.transferRequirements || []).map((req: any, idx: number) => (
                                      <li key={idx}>Gửi <b>{req.quantity}x {req.productName}</b> từ <b>{req.fromWarehouseName}</b></li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-red-600 font-medium">❌ Hệ thống hết hàng cho đơn này.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
              <div className="flex justify-between items-center border-b pb-3 mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-green-500" /> Sản phẩm</h3>
                <button type="button" onClick={handleAddItem} className="btn-secondary btn-sm"><Plus className="w-4 h-4 mr-1" /> Thêm Dòng</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px]">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <select className="input text-sm flex-1" value={item.productId} onChange={e => handleUpdateItem(index, 'productId', e.target.value)}>
                      <option value="">-- Chọn SP --</option>
                      {(availableProducts || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min={1} className="input text-sm w-20 text-center font-bold" value={item.quantity || ''} onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                    <div className="w-28 text-right font-bold text-primary-600 text-sm">{formatCurrency(item.quantity * item.unitPrice)}</div>
                    <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t bg-white rounded-b-2xl flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500 hidden md:block">
            {isAdmin() ? (form.assignedWarehouseId ? 'Đã chọn chi nhánh xuất hàng.' : 'Vui lòng chọn 1 chi nhánh xuất hàng ở mục Định tuyến.') : 'Chi nhánh của bạn sẽ mặc định đóng gói đơn này.'}
          </p>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="btn-secondary px-8 py-2.5 text-base w-full md:w-auto">Hủy bỏ</button>
            <button 
              onClick={handleSubmit} 
              disabled={!isValid || createMut.isPending}
              className="btn-primary px-8 py-2.5 text-base w-full md:w-auto shadow-md"
            >
              {createMut.isPending ? <Spinner size="sm" className="text-white" /> : 'Chốt Đơn (Tạo)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}