import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <-- ĐÃ THÊM IMPORT NÀY
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Plus, Trash2, ShoppingBag, MapPin, CreditCard, User, Lightbulb, CheckCircle2, AlertCircle, Building2, Tag, Gift, Truck } from 'lucide-react'; 
import AsyncSelect from 'react-select/async'; 
import { orderService } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
import { productService } from '@/services/product.service';
import { inventoryService } from '@/services/inventory.service';
import { promotionService } from '@/services/promotion.service';
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
  const [currentCustomer, setCurrentCustomer] = useState<{value: string, label: string, original: any} | null>(null);

  // [FIX 4, 5] Thêm state cho Phí ship, Khuyến mãi, Điểm
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  // CONSOLIDATION PLAN STATE
  const [consolidationPlans, setConsolidationPlans] = useState<any[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const validItems = items.filter(i => i.productId && i.quantity > 0);
      if (!form.provinceCode || validItems.length === 0 || validItems.length !== items.length) {
        if (validItems.length === 0) setConsolidationPlans([]);
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
  }, [form.provinceCode, items]);

  const loadCustomerOptions = async (inputValue: string) => {
    try {
      const response = await customerService.getAll({ keyword: inputValue, size: 20 });
      const custs = response.data?.data?.content || []; 
      return custs.map((c: any) => ({ value: c.id, label: `${c.fullName} - ${c.phoneNumber}`, original: c }));
    } catch { return []; }
  };

  // [FIX 6] Hàm đoán mã tỉnh từ địa chỉ
  const guessProvinceCode = (address: string) => {
    if (!address) return '';
    const lower = address.toLowerCase();
    if (lower.includes('hà nội') || lower.includes('ha noi')) return '01';
    if (lower.includes('hồ chí minh') || lower.includes('ho chi minh') || lower.includes('hcm') || lower.includes('sài gòn')) return '79';
    if (lower.includes('đà nẵng') || lower.includes('da nang')) return '48';
    if (lower.includes('hải phòng') || lower.includes('hai phong')) return '31';
    if (lower.includes('cần thơ') || lower.includes('can tho')) return '92';
    if (lower.includes('lào cai') || lower.includes('lao cai')) return '10';
    return '';
  };

  const handleCustomerChange = (selected: any) => {
    setCurrentCustomer(selected);
    if (selected?.original) {
      const cust = selected.original;
      const guessedProvince = guessProvinceCode(cust.address);
      setForm(prev => ({ 
        ...prev, 
        customerId: cust.id, 
        shippingName: cust.fullName, 
        shippingPhone: cust.phoneNumber, 
        shippingAddress: cust.address,
        provinceCode: guessedProvince || prev.provinceCode // Tự động điền tỉnh
      }));
      setPointsToUse(0);
    } else {
      setForm(prev => ({ ...prev, customerId: '', shippingName: '', shippingPhone: '', shippingAddress: '' }));
      setPointsToUse(0);
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

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const loyaltyDiscount = pointsToUse * 100; // 100đ/điểm
  const finalAmount = Math.max(0, totalAmount + shippingFee - promotionDiscount - loyaltyDiscount);

  // [FIX 5] Validate Promotion Code
  const validatePromoMut = useMutation({
    mutationFn: (code: string) => promotionService.validateCode({ code, orderTotal: totalAmount, channel: 'ONLINE' }).then(r => r.data.data),
    onSuccess: (res) => {
      setPromotionDiscount(res.discountAmount || 0);
      toast.success(`Áp dụng mã ${res.code} thành công!`);
    },
    onError: (e: any) => {
      setPromotionDiscount(0);
      setPromotionCode('');
      toast.error(e?.response?.data?.message || 'Mã không hợp lệ');
    }
  });

  const handleApplyPromo = () => {
    if (!promotionCode.trim()) return;
    validatePromoMut.mutate(promotionCode.trim());
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
        assignedWarehouseId: form.assignedWarehouseId, 
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingFee: shippingFee,
        promotionCode: promotionDiscount > 0 ? promotionCode : undefined,
        pointsToUse: pointsToUse > 0 ? pointsToUse : undefined,
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
        toast.error(`Sản phẩm "${product.name}" không đủ tồn kho! Bạn đang đặt ${totalQty} nhưng hệ thống chỉ còn ${product.displayQuantity}.`);
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
      newItems[index] = { ...newItems[index], productId: value, unitPrice: selected?.retailPrice || 0, productName: selected?.name || '', quantity: 1 };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const isValid = form.customerId && form.shippingName && form.shippingPhone && form.shippingAddress && form.provinceCode &&
                  items.length > 0 && items.every(i => i.productId && i.quantity > 0) &&
                  (!isAdmin() || form.assignedWarehouseId);

  const handleSubmit = () => {
    if (!validateTotalStock()) return; 
    createMut.mutate();
  };

  const hasValidItems = items.length > 0 && items.some(i => i.productId);

  // ĐÃ SỬA: Đưa nội dung Modal vào createPortal để che phủ 100% màn hình
  const modalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-slide-up border border-slate-100">
        
        <div className="flex justify-between items-center p-5 border-b bg-blue-600 text-white rounded-t-3xl shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Tạo đơn hàng Telesale</h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/50 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3"><User className="w-4 h-4 text-blue-500" /> Thông tin Khách hàng</h3>
              <AsyncSelect cacheOptions defaultOptions loadOptions={loadCustomerOptions} value={currentCustomer} onChange={handleCustomerChange} placeholder="Gõ tên hoặc SĐT..." className="text-sm font-medium"/>
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Tên người nhận..." value={form.shippingName} onChange={e => setForm({ ...form, shippingName: e.target.value })} />
              <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Số điện thoại..." value={form.shippingPhone} onChange={e => setForm({ ...form, shippingPhone: e.target.value })} />
              <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" rows={2} placeholder="Địa chỉ chi tiết..." value={form.shippingAddress} onChange={e => setForm({ ...form, shippingAddress: e.target.value })} />
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3"><CreditCard className="w-4 h-4 text-purple-500" /> Thanh toán & Ghi chú</h3>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}><option value="COD">Thanh toán khi nhận (COD)</option><option value="BANK_TRANSFER">Chuyển khoản</option></select>
              <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" rows={2} placeholder="Ghi chú đơn hàng..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hình thức</label>
                  <select className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="DELIVERY">Giao hàng (DELIVERY)</option>
                    <option value="BOPIS">Nhận tại quầy (BOPIS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tỉnh / TP Giao hàng *</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.provinceCode} onChange={e => setForm({ ...form, provinceCode: e.target.value })}>
                    <option value="">-- Chọn Tỉnh/TP --</option>
                    {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* KẾ HOẠCH GOM HÀNG */}
              {form.provinceCode && hasValidItems && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl min-h-[120px] transition-all mt-4">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" /> Kế hoạch Phân bổ Kho (Consolidation Plan)
                    {isSuggesting && <Spinner size="sm" className="ml-2 text-indigo-500" />}
                  </h4>
                  
                  <div className={`transition-opacity duration-300 ${isSuggesting ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {suggestError ? (
                      <p className="text-sm text-red-600 font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {suggestError}</p>
                    ) : consolidationPlans.length > 0 ? (
                      <div className="space-y-3">
                        {consolidationPlans.map((plan: any) => {
                          const isSelected = form.assignedWarehouseId === plan.warehouseId;
                          // Nếu là Manager, chỉ cho phép chọn kho của chính họ
                          if (!isAdmin() && plan.warehouseId !== user?.warehouseId) return null;
                          
                          return (
                            <div key={plan.warehouseId} onClick={() => setForm({ ...form, assignedWarehouseId: plan.warehouseId })} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-white shadow-md' : 'border-slate-200 bg-white/50 hover:border-indigo-300'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-slate-900">{plan.warehouseName} {plan.isSameProvince && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded ml-2">Cùng Tỉnh</span>}</p>
                                {isSelected ? <CheckCircle2 className="w-5 h-5 text-indigo-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300"/>}
                              </div>
                              {plan.isReadyToShip ? (
                                <p className="text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block font-medium">✓ Kho đủ hàng. Có thể đóng gói ngay!</p>
                              ) : (
                                <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                  <p className="font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Kho thiếu hàng. Hệ thống sẽ tự động tạo phiếu luân chuyển từ:</p>
                                  <ul className="list-disc ml-6 mt-1.5 opacity-90 space-y-0.5">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex-1 flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-green-500" /> Sản phẩm</h3>
                <button type="button" onClick={handleAddItem} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"><Plus className="w-3.5 h-3.5" /> Thêm Dòng</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[250px] custom-scrollbar pr-1">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                    <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:border-indigo-500 outline-none flex-1" value={item.productId} onChange={e => handleUpdateItem(index, 'productId', e.target.value)}>
                      <option value="">-- Chọn SP --</option>
                      {(availableProducts || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min={1} className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center text-slate-800 focus:border-indigo-500 outline-none" value={item.quantity || ''} onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                    <div className="w-28 text-right font-black text-indigo-600 text-[15px] tracking-tight">{formatCurrency(item.quantity * item.unitPrice)}</div>
                    <button onClick={() => handleRemoveItem(index)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              {/* Khu vực tính tiền, Phí ship, Khuyến mãi */}
              {items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-500">Tổng tiền hàng</span>
                    <span className="font-bold text-slate-800 text-base">{formatCurrency(totalAmount)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5"><Truck className="w-4 h-4 text-slate-400"/> Phí vận chuyển</span>
                    <input 
                      type="number" min={0} step={1000}
                      className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-right text-slate-800 focus:border-indigo-500 outline-none shadow-sm" 
                      placeholder="0"
                      value={shippingFee || ''}
                      onChange={e => setShippingFee(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5"><Tag className="w-4 h-4 text-slate-400"/> Mã khuyến mãi</span>
                    <div className="flex gap-2 w-48">
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800 focus:border-indigo-500 outline-none uppercase shadow-sm" 
                        placeholder="Mã KM..."
                        value={promotionCode}
                        onChange={e => setPromotionCode(e.target.value.toUpperCase())}
                        disabled={promotionDiscount > 0}
                      />
                      {promotionDiscount > 0 ? (
                        <button onClick={() => { setPromotionCode(''); setPromotionDiscount(0); }} className="px-3 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors">Xóa</button>
                      ) : (
                        <button onClick={handleApplyPromo} disabled={validatePromoMut.isPending || !promotionCode} className="px-3 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50">Áp dụng</button>
                      )}
                    </div>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-end text-[15px] font-black tracking-tight text-emerald-600">- {formatCurrency(promotionDiscount)}</div>
                  )}

                  {currentCustomer?.original && currentCustomer.original.loyaltyPoints >= 500 && (
                    <div className="flex items-center justify-between gap-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                      <span className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Gift className="w-4 h-4 text-blue-500"/> Đổi điểm ({currentCustomer.original.loyaltyPoints} điểm)</span>
                      <select 
                        className="w-32 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-700 focus:border-blue-500 outline-none shadow-sm cursor-pointer"
                        value={pointsToUse}
                        onChange={e => setPointsToUse(parseInt(e.target.value))}
                      >
                        <option value={0}>Không đổi</option>
                        {Array.from({ length: Math.floor(currentCustomer.original.loyaltyPoints / 500) }, (_, i) => (i + 1) * 500).map(pts => (
                          <option key={pts} value={pts}>-{formatCurrency(pts * 100)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-between items-end pt-4 border-t border-slate-200 mt-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">Khách phải trả</span>
                    <span className="text-3xl font-black text-indigo-600 tracking-tight">{formatCurrency(finalAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white rounded-b-3xl flex items-center justify-between shrink-0">
          <p className="text-xs font-medium text-slate-400 hidden md:block">
            {isAdmin() ? (form.assignedWarehouseId ? 'Đã chọn chi nhánh xuất hàng.' : 'Vui lòng chọn 1 chi nhánh xuất hàng ở mục Kế hoạch phân bổ.') : 'Chi nhánh của bạn sẽ mặc định đóng gói đơn này.'}
          </p>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors w-full md:w-auto">Hủy bỏ</button>
            <button 
              onClick={handleSubmit} 
              disabled={!isValid || createMut.isPending}
              className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-[0_4px_12px_rgb(99,102,241,0.3)] disabled:opacity-50 disabled:shadow-none w-full md:w-auto flex items-center justify-center"
            >
              {createMut.isPending ? <Spinner size="sm" className="text-white" /> : 'Chốt Đơn (Tạo)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}