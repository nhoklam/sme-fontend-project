import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Search, User, CreditCard, Banknote, Smartphone,
  QrCode, Plus, Minus, Trash2, X, ChevronRight, UserPlus,
  Lock, CheckCircle, Package, RotateCcw, Clock, Tag
} from 'lucide-react';
import { posService } from '@/services/pos.service';
import { productService } from '@/services/product.service';
import { customerService } from '@/services/customer.service';
import { inventoryService } from '@/services/inventory.service';
import { useAuthStore } from '@/stores/auth.store';
import { usePOSStore } from '@/stores/pos.store';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui';

import type { CartItem, PaymentMethod, InvoiceResponse } from '@/types';

// ── CẤU HÌNH & HẰNG SỐ ──────────────────────────────────────
const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType; fundType: string }[] = [
  { id: 'CASH',  label: 'Tiền mặt',  icon: Banknote,   fundType: 'CASH_111' },
  { id: 'CARD',  label: 'Thẻ (POS)', icon: CreditCard, fundType: 'BANK_112' },
  { id: 'MOMO',  label: 'Mã QR MoMo',icon: Smartphone, fundType: 'BANK_112' },
  { id: 'VNPAY', label: 'Mã QR VNPay',icon: QrCode,     fundType: 'BANK_112' },
];

const LOYALTY_RATE = 100; // 1 điểm = 100 VNĐ

// ═══════════════════════════════════════════════════════════════
export default function POSPage() {
  const { user } = useAuthStore();
  const {
    currentShift, setCurrentShift,
    items, customer, pointsToUse, note,
    addItem, updateQuantity, removeItem, updateUnitPrice,
    setCustomer, setPointsToUse,
    clearCart, holdCart, recallCart, savedCarts,
    totalAmount, discountAmount, finalAmount,
  } = usePOSStore();

  // ── STATES SẢN PHẨM & BÁN SỈ ──
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isWholesale, setIsWholesale] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  // ── STATES KHÁCH HÀNG (FULL-TEXT SEARCH) ──
  const [custSearchTerm, setCustSearchTerm] = useState('');
  const [debouncedCustSearch, setDebouncedCustSearch] = useState('');
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // ── STATES THANH TOÁN ──
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: number; reference?: string }[]>([]);
  const [activePayMethod, setActivePayMethod] = useState<PaymentMethod>('CASH');
  const [cashAmount, setCashAmount] = useState('');
  const [referenceInput, setReferenceInput] = useState(''); 

  // ── STATES MODALS ──
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [reportedCash, setReportedCash] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [lastInvoice, setLastInvoice] = useState<InvoiceResponse | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  // ── STATES TRẢ HÀNG ──
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [searchInvoiceCode, setSearchInvoiceCode] = useState('');
  const [invoiceToRefund, setInvoiceToRefund] = useState<InvoiceResponse | null>(null);
  const [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const [returnDestination, setReturnDestination] = useState('STOCK');

  // ── STATES LỊCH SỬ CA ──
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const custSearchRef = useRef<HTMLInputElement>(null);

  // ── DEBOUNCE SẢN PHẨM & KHÁCH HÀNG ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustSearch(custSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [custSearchTerm]);

  // ── QUERIES ──
  const { data: suggestions, isFetching: isSearching } = useQuery({
    queryKey: ['pos-search', debouncedSearch],
    queryFn: () => productService.getProducts({ keyword: debouncedSearch, size: 10, isActive: true }).then(r => r.data.data.content),
    enabled: debouncedSearch.length > 1,
  });

  const { data: custSuggestions, isFetching: isSearchingCust } = useQuery({
    queryKey: ['pos-customer-search', debouncedCustSearch],
    queryFn: () => customerService.getAll({ keyword: debouncedCustSearch, size: 5 }).then((r: any) => r.data.data.content || r.data.data),
    enabled: debouncedCustSearch.length > 1,
  });

  const { data: branchInventory } = useQuery({
    queryKey: ['pos-inventory', currentShift?.warehouseId || user?.warehouseId],
    queryFn: () => inventoryService.getByWarehouse(currentShift?.warehouseId || user?.warehouseId!).then((r: any) => r.data.data),
    enabled: !!(currentShift?.warehouseId || user?.warehouseId),
  });

  const { data: shiftData } = useQuery({
    queryKey: ['current-shift'],
    queryFn: () => posService.getCurrentShift().then(r => r.data.data),
    retry: false,
  });

  useEffect(() => {
    if (shiftData !== undefined) setCurrentShift(shiftData);
  }, [shiftData, setCurrentShift]);

  // ── XỬ LÝ SẢN PHẨM & GIỎ HÀNG ──
  const displaySuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.map((p: any) => {
      const inv = branchInventory?.find((i: any) => i.productId === p.id);
      return { ...p, branchQuantity: inv?.availableQuantity || 0 };
    });
  }, [suggestions, branchInventory]);

  const handleSelectProduct = (product: any) => {
    if (product.branchQuantity <= 0) {
      toast('Sản phẩm này hiện đang báo hết hàng trong kho!', { icon: '⚠️', style: { color: '#d97706' } });
    }
    const appliedPrice = isWholesale ? (product.wholesalePrice ?? product.retailPrice) : product.retailPrice;

    const cartItem: CartItem = {
      productId:   product.id,
      productName: product.name,
      isbnBarcode: product.isbnBarcode,
      quantity:    1,
      unitPrice:   appliedPrice,
      macPrice:    product.macPrice,
      subtotal:    appliedPrice,
      imageUrl:    product.imageUrl,
      unit:        product.unit || 'Cái',
    };
    addItem(cartItem);
    setSearchTerm('');
    setShowSuggestions(false);
    barcodeRef.current?.focus();
    try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
  };

  const scanMut = useMutation({
    mutationFn: (code: string) => productService.getByBarcode(code).then(r => r.data.data),
    onSuccess: (product) => {
      const inv = branchInventory?.find((i: any) => i.productId === product.id);
      const branchQty = inv?.availableQuantity || 0;

      if (branchQty <= 0) {
        toast('Sản phẩm quét được đang báo hết hàng trong kho!', { icon: '⚠️', style: { color: '#d97706' } });
      }

      const appliedPrice = isWholesale ? (product.wholesalePrice ?? product.retailPrice) : product.retailPrice;

      const cartItem: CartItem = {
        productId:   product.id,
        productName: product.name,
        isbnBarcode: product.isbnBarcode,
        quantity:    1,
        unitPrice:   appliedPrice,
        macPrice:    product.macPrice,
        subtotal:    appliedPrice,
        imageUrl:    product.imageUrl,
        unit:        product.unit || 'Cái',
      };
      addItem(cartItem);
      setSearchTerm('');
      setShowSuggestions(false);
      try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setSearchTerm('');
    },
  });

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      scanMut.mutate(searchTerm.trim());
      setShowSuggestions(false);
    }
  };

  // ── XỬ LÝ KHÁCH HÀNG ──
  const createCustomerMut = useMutation({
    mutationFn: (data: { fullName: string; phoneNumber: string }) => customerService.create(data).then(r => r.data.data),
    onSuccess: (cust) => {
      setCustomer(cust);
      setShowCreateCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCustSearchTerm('');
      toast.success('Tạo thành công & Đã gán khách vào đơn!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── MUTATIONS CA LÀM & THANH TOÁN ──
  const openShiftMut = useMutation({
    mutationFn: () => posService.openShift({ startingCash: parseFloat(startingCash) || 0 }),
    onSuccess: (res) => { setCurrentShift(res.data.data); setShowOpenShift(false); setStartingCash(''); toast.success('Mở ca thành công!'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const closeShiftMut = useMutation({
    mutationFn: () => posService.closeShift({ reportedCash: parseFloat(reportedCash) || 0, discrepancyReason: discrepancyReason || undefined }),
    onSuccess: (res) => { setCurrentShift(res.data.data); setShowCloseShift(false); toast.success('Đóng ca thành công! Chờ Manager duyệt.'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const checkoutMut = useMutation({
    mutationFn: () => {
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      if (totalPaid < finalAmount()) throw new Error('Tổng tiền thanh toán chưa đủ');
      return posService.checkout({
        shiftId: currentShift!.id,
        customerId: customer?.id,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
        payments: payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference || undefined })),
        pointsToUse: pointsToUse || undefined,
        note: note || undefined,
      }).then(r => r.data.data);
    },
    onSuccess: (invoice) => {
      setLastInvoice(invoice); setShowInvoice(true); setShowCheckout(false); clearCart(); setPayments([]); setCashAmount(''); setReferenceInput(''); toast.success(`Thanh toán thành công! Mã HĐ: ${invoice.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── TRẢ HÀNG & LỊCH SỬ ──
  const refundTotalAmount = useMemo(() => {
    if (!invoiceToRefund) return 0;
    return Object.entries(refundItems).reduce((sum, [productId, qty]) => {
      const item = invoiceToRefund.items.find(i => i.productId === productId);
      return sum + (item ? item.unitPrice * qty : 0);
    }, 0);
  }, [refundItems, invoiceToRefund]);

  const searchInvoiceMut = useMutation({
    mutationFn: (code: string) => posService.getInvoiceByCode(code).then(r => r.data.data),
    onSuccess: (data) => {
      if (data.type === 'RETURN') return toast.error('Hóa đơn này là hóa đơn trả hàng, không thể trả tiếp!');
      setInvoiceToRefund(data);
      const initialRefunds: Record<string, number> = {};
      data.items.forEach(i => initialRefunds[i.productId] = 0);
      setRefundItems(initialRefunds);
    },
    onError: () => toast.error('Không tìm thấy hóa đơn. Kiểm tra lại mã!'),
  });

  const submitRefundMut = useMutation({
    mutationFn: () => {
      const itemsToRefund = Object.entries(refundItems).filter(([_, qty]) => qty > 0).map(([productId, quantity]) => ({ productId, quantity }));
      return posService.refund({ originalInvoiceId: invoiceToRefund!.id, shiftId: currentShift!.id, items: itemsToRefund, returnDestination, note: `Khách trả hàng. HĐ gốc: ${invoiceToRefund!.code}` });
    },
    onSuccess: (res) => { toast.success('Trả hàng hoàn tiền thành công!'); setLastInvoice(res.data.data); setShowInvoice(true); setShowRefundModal(false); setInvoiceToRefund(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: shiftHistoryData, isLoading: loadingHistory } = useQuery({
    queryKey: ['shift-invoices', currentShift?.id, historyPage],
    queryFn: () => posService.getInvoicesByShift(currentShift!.id, historyPage, 10).then(r => r.data.data),
    enabled: !!currentShift?.id && showHistoryModal, 
  });

  const printInvoiceMut = useMutation({
    mutationFn: (id: string) => posService.getInvoice(id).then(r => r.data.data),
    onSuccess: (data) => { setLastInvoice(data); setShowInvoice(true); setShowHistoryModal(false); },
    onError: () => toast.error('Không thể tải chi tiết hóa đơn.'),
  });

  // ── KEYBOARD SHORTCUTS ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); if (items.length > 0 && currentShift) setShowCheckout(true); }
      if (e.key === 'F2') { e.preventDefault(); holdCart(); toast('Đã lưu tạm giỏ hàng', { icon: '💾' }); }
      if (e.key === 'F3') { e.preventDefault(); custSearchRef.current?.focus(); }
      if (e.key === 'F5') { e.preventDefault(); if (savedCarts?.length > 0) setShowRecallModal(true); }
      if (e.key === 'Escape') { 
        setShowCheckout(false); setShowOpenShift(false); setShowCloseShift(false); 
        setShowInvoice(false); setShowRecallModal(false); setShowRefundModal(false); setShowHistoryModal(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, currentShift, holdCart, savedCarts?.length]);

  const handleAddPayment = () => {
    const amt = parseFloat(cashAmount);
    if (!amt || amt <= 0) return;
    setPayments(prev => {
      const existing = prev.find(p => p.method === activePayMethod);
      if (existing) return prev.map(p => p.method === activePayMethod ? { ...p, amount: amt, reference: referenceInput } : p);
      return [...prev, { method: activePayMethod, amount: amt, reference: referenceInput }];
    });
    setCashAmount(''); setReferenceInput('');
  };

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const change = totalPaid - finalAmount();
  const remaining = Math.max(0, finalAmount() - totalPaid);
  const hasQRPayment = payments.some(p => p.method === 'MOMO' || p.method === 'VNPAY');

  // ── 1. GIAO DIỆN CHƯA MỞ CA ──
  if (!currentShift || currentShift.status !== 'OPEN') {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center bg-gray-50 p-4 w-full">
        {!showOpenShift ? (
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Chưa mở ca làm việc</h2>
            <p className="text-gray-500 text-sm mb-6">Bạn cần mở ca trước khi bắt đầu bán hàng.</p>
            <button onClick={() => setShowOpenShift(true)} className="btn-primary px-8 py-3 text-base w-full">
              Mở ca mới
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100">
            <h3 className="font-bold text-lg mb-4 text-center">Mở ca làm việc</h3>
            <div className="mb-4">
              <label className="label">Tiền đầu ca trong két (VNĐ)</label>
              <input type="number" className="input mt-1" placeholder="Ví dụ: 500000" value={startingCash} onChange={e => setStartingCash(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && openShiftMut.mutate()} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpenShift(false)} className="btn-secondary flex-1">Hủy</button>
              <button onClick={() => openShiftMut.mutate()} disabled={openShiftMut.isPending} className="btn-primary flex-1">{openShiftMut.isPending ? <Spinner size="sm" /> : 'Xác nhận'}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 2. GIAO DIỆN BÁN HÀNG POS ──
  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col overflow-hidden" style={{ zIndex: 50 }}>
      {/* ── POS Header ── */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-primary-400">POS</span>
          <span className="text-gray-400">{user?.warehouseName ?? user?.fullName}</span>
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" /> Ca #{currentShift.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {savedCarts?.length > 0 && (
            <button onClick={() => setShowRecallModal(true)} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300">
              <RotateCcw className="w-3.5 h-3.5" /> Gọi lại đơn ({savedCarts.length}) <span className="pos-key bg-gray-700 border-gray-600 text-gray-300">F5</span>
            </button>
          )}
          
          <button onClick={() => setShowHistoryModal(true)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Lịch sử ca
          </button>

          <button onClick={() => setShowRefundModal(true)} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Trả hàng
          </button>
          
          <button onClick={() => setShowCloseShift(true)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 ml-2">
            <Lock className="w-3.5 h-3.5" /> Đóng ca
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Cart */}
        <div className="flex-1 flex flex-col bg-gray-900 relative">
          
          <div className="p-4 border-b border-gray-700 flex gap-3 relative z-40">
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                ref={barcodeRef}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base shadow-inner"
                placeholder="Quét mã vạch, mã sách (ISBN) hoặc gõ tên sản phẩm... (F4)"
                autoFocus
              />
              {(scanMut.isPending || isSearching) && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2"><Spinner size="sm" className="text-primary-500" /></div>
              )}

              {showSuggestions && displaySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-y-auto max-h-[300px]">
                  {displaySuggestions.map((p: any) => (
                    <div key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer flex justify-between items-center last:border-b-0 transition-colors">
                      <div className="w-10 h-10 bg-white rounded flex items-center justify-center overflow-hidden flex-shrink-0 mr-3">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-white font-medium text-sm truncate">{p.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">Mã: {p.isbnBarcode} {p.sku ? `| SKU: ${p.sku}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {/* Hiển thị giá tùy theo đang bật Bán Sỉ hay không */}
                        <p className="text-primary-400 font-bold text-sm">
                          {formatCurrency(isWholesale ? (p.wholesalePrice ?? p.retailPrice) : p.retailPrice)}
                        </p>
                        <p className={`text-xs mt-0.5 ${p.branchQuantity > 0 ? 'text-green-400' : 'text-red-400'}`}>Tồn: {p.branchQuantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* NÚT TOGGLE BÁN SỈ */}
            <button 
              onClick={() => setIsWholesale(!isWholesale)}
              className={`flex items-center gap-2 px-4 rounded-xl font-medium transition-all border ${
                isWholesale 
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                  : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700 hover:text-white'
              }`}
              title="Bật/Tắt chế độ áp dụng Giá Sỉ (Wholesale)"
            >
              <Tag className="w-5 h-5" />
              Bán Sỉ
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Giỏ hàng trống</p>
                <p className="text-xs mt-1 opacity-60">Quét mã vạch (Scanner) để thêm sản phẩm</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.productId} className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate max-w-[200px]">{item.productName}</p>
                      <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded border border-gray-600">{item.unit || 'Cái'}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{item.isbnBarcode}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-primary-400 font-bold text-sm">{formatCurrency(item.subtotal)}</p>
                    {editingPriceId === item.productId ? (
                      <input
                        type="number" autoFocus defaultValue={item.unitPrice}
                        onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 0) updateUnitPrice(item.productId, val); setEditingPriceId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPriceId(null); }}
                        className="w-20 text-xs text-right bg-gray-700 text-white border border-gray-500 rounded px-1 mt-0.5 outline-none focus:border-primary-500"
                      />
                    ) : (
                      <p className="text-gray-500 text-xs mt-0.5 cursor-pointer hover:text-blue-400 underline decoration-dashed" title="Click để sửa giá trực tiếp" onClick={() => setEditingPriceId(item.productId)}>
                        {formatCurrency(item.unitPrice)}/sp
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-600 hover:text-white"><Minus className="w-3 h-3" /></button>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val > 0) updateQuantity(item.productId, val); }} className="w-12 h-8 text-center bg-gray-900 border border-gray-600 text-white rounded font-mono text-sm focus:outline-none focus:border-primary-500" style={{ appearance: 'textfield' }} />
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-600 hover:text-white"><Plus className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="text-gray-600 hover:text-red-400 transition-colors ml-1 p-2"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-gray-700 p-4 space-y-2 bg-gray-800">
              <div className="flex justify-between text-gray-400 text-sm">
                <span>Tạm tính ({items.reduce((s, i) => s + i.quantity, 0)} sản phẩm)</span>
                <span>{formatCurrency(totalAmount())}</span>
              </div>
              {discountAmount() > 0 && (
                <div className="flex justify-between text-green-400 text-sm">
                  <span>Khuyến mãi / Trừ điểm</span>
                  <span>-{formatCurrency(discountAmount())}</span>
                </div>
              )}
              <div className="flex justify-between text-white text-xl font-bold">
                <span>TỔNG CỘNG</span>
                <span className="text-primary-400">{formatCurrency(finalAmount())}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: KHÁCH HÀNG & THANH TOÁN */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col shadow-2xl z-10">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-sm font-medium">Khách hàng thành viên</span>
              <span className="ml-auto pos-key bg-gray-700 border-gray-600 text-gray-300">F3</span>
            </div>

            {/* TẠO MỚI KHÁCH HÀNG */}
            {showCreateCustomer ? (
              <div className="bg-gray-700 rounded-xl p-4 border border-gray-500 shadow-inner animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-green-400" />
                  <p className="text-white font-medium text-sm">Tạo khách hàng mới</p>
                </div>
                <div className="space-y-3">
                  <input
                    type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                    placeholder="Số điện thoại..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-green-500 text-sm"
                  />
                  <input
                    type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCustomerName.trim() && newCustomerPhone.trim()) {
                        e.preventDefault();
                        createCustomerMut.mutate({ fullName: newCustomerName.trim(), phoneNumber: newCustomerPhone.trim() });
                      }
                    }}
                    placeholder="Nhập tên khách hàng..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-green-500 text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowCreateCustomer(false)} className="flex-1 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-600 border border-gray-600 rounded-lg transition-colors">Hủy</button>
                    <button
                      onClick={() => {
                        if (!newCustomerName.trim() || !newCustomerPhone.trim()) return toast.error('Vui lòng nhập đủ Tên và SĐT!');
                        createCustomerMut.mutate({ fullName: newCustomerName.trim(), phoneNumber: newCustomerPhone.trim() });
                      }}
                      disabled={createCustomerMut.isPending}
                      className="flex-1 py-2 text-sm text-white bg-green-600 hover:bg-green-500 rounded-lg font-medium flex justify-center items-center transition-colors shadow-lg shadow-green-900/50"
                    >
                      {createCustomerMut.isPending ? <Spinner size="sm" /> : '✓ Lưu'}
                    </button>
                  </div>
                </div>
              </div>
            ) : customer ? (
              <div className="bg-gray-700 rounded-xl p-3 border border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{customer.fullName}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{customer.phoneNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => setCustomer(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${customer.customerTier === 'GOLD' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' : customer.customerTier === 'SILVER' ? 'bg-gray-600 text-gray-300 border border-gray-500' : 'bg-blue-900/50 text-blue-400 border border-blue-700'}`}>
                      Hạng {customer.customerTier}
                    </span>
                  </div>
                </div>
                
                {/* ── THAY ĐỔI: GIAO DIỆN VOUCHER 50K (THAY CHO NHẬP ĐIỂM) ── */}
                <div className="mt-3 pt-3 border-t border-gray-600 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Đang có: <strong className="text-white">{customer.loyaltyPoints}</strong> điểm</span>
                  </div>
                  
                  {customer.loyaltyPoints >= 500 && (
                    <div className="flex items-center justify-between p-2 bg-green-900/20 border border-green-700/50 rounded-lg">
                      <span className="text-green-400 text-xs font-medium">🎁 Voucher giảm 50.000đ</span>
                      <button 
                        onClick={() => setPointsToUse(pointsToUse === 500 ? 0 : 500)}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          pointsToUse === 500 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {pointsToUse === 500 ? 'Đã áp dụng' : 'Dùng 500 điểm'}
                      </button>
                    </div>
                  )}
                </div>
                {/* ──────────────────────────────────────────────────────── */}
                
              </div>
            ) : (
              // TÌM KIẾM KHÁCH HÀNG FULL-TEXT
              <div className="relative">
                <input
                  ref={custSearchRef}
                  value={custSearchTerm}
                  onChange={e => { setCustSearchTerm(e.target.value); setShowCustSuggestions(true); }}
                  onFocus={() => setShowCustSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustSuggestions(false), 200)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-xl pl-3 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm shadow-inner"
                  placeholder="Gõ tên, SĐT tìm KH hoặc Thêm mới..."
                />
                {isSearchingCust ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" className="text-gray-400" /></div>
                ) : (
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                )}

                {showCustSuggestions && custSearchTerm.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-y-auto max-h-[250px] z-50">
                    {custSuggestions && custSuggestions.length > 0 ? (
                      custSuggestions.map((c: any) => (
                        <div key={c.id} onClick={() => { setCustomer(c); setShowCustSuggestions(false); setCustSearchTerm(''); }} className="px-4 py-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors">
                          <p className="text-white font-medium text-sm">{c.fullName}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{c.phoneNumber} • Hạng {c.customerTier}</p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-center">
                        <p className="text-gray-400 text-sm mb-3">Không tìm thấy khách hàng nào</p>
                        <button 
                          onClick={() => {
                            setNewCustomerName(isNaN(Number(custSearchTerm)) ? custSearchTerm : '');
                            setNewCustomerPhone(!isNaN(Number(custSearchTerm)) ? custSearchTerm : '');
                            setShowCreateCustomer(true);
                            setShowCustSuggestions(false);
                          }}
                          className="btn-primary btn-sm mx-auto"
                        >
                          <UserPlus className="w-4 h-4 mr-1" /> Tạo mới ngay
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── BƯỚC 5: PHƯƠNG THỨC THANH TOÁN ── */}
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex justify-between items-end mb-3">
              <p className="text-gray-400 text-sm font-medium">Phương thức thanh toán</p>
              {finalAmount() > 0 && (
                <button 
                  onClick={() => { setActivePayMethod('CASH'); setPayments([{ method: 'CASH', amount: finalAmount() }]); setCashAmount(''); }}
                  className="text-primary-400 hover:text-primary-300 text-xs font-bold bg-primary-900/30 px-2 py-1.5 rounded border border-primary-800/50 transition-colors"
                >
                  ✓ Khách đưa đủ tiền
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActivePayMethod(m.id);
                    if (remaining > 0 && !cashAmount) {
                      setPayments(prev => {
                        if (prev.some(p => p.method === m.id)) return prev;
                        return [...prev, { method: m.id, amount: remaining }];
                      });
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                    activePayMethod === m.id ? 'bg-primary-600 text-white shadow-lg border border-primary-500' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white border border-transparent'
                  }`}
                >
                  <m.icon className="w-4 h-4" /> {m.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPayment()}
                className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500 text-sm shadow-inner min-w-0"
                placeholder="Số tiền (VNĐ)"
              />
              {activePayMethod !== 'CASH' && (
                <input
                  type="text" value={referenceInput} onChange={e => setReferenceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPayment()}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-500 text-sm shadow-inner min-w-0"
                  placeholder="Mã GD (Tùy chọn)..."
                />
              )}
              <button onClick={handleAddPayment} className="bg-gray-600 hover:bg-gray-500 text-white rounded-xl px-4 font-medium text-sm transition-colors border border-gray-500 shrink-0">Thêm</button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {[100000, 200000, 500000, 1000000, 2000000].concat(finalAmount() > 0 ? [Math.ceil(finalAmount() / 1000) * 1000] : []).slice(0, 6).map(amt => (
                <button key={amt} onClick={() => { setActivePayMethod('CASH'); setPayments([{ method: 'CASH', amount: amt }]); setCashAmount(''); }} className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg py-2 text-xs font-mono transition-colors border border-gray-600 hover:border-gray-500 shadow-sm">
                  {amt >= 1000000 ? (amt / 1000000) + 'M' : (amt / 1000) + 'k'}
                </button>
              ))}
            </div>

            {payments.length > 0 && (
              <div className="space-y-2 mb-4 bg-gray-900 p-2 rounded-xl border border-gray-700">
                {payments.map(p => (
                  <div key={p.method} className="flex flex-col bg-gray-800 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-medium">{PAYMENT_METHODS.find(m => m.id === p.method)?.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-sm">{formatCurrency(p.amount)}</span>
                        <button onClick={() => setPayments(prev => prev.filter(x => x.method !== p.method))} className="text-gray-500 hover:text-red-400 bg-gray-700 rounded-full p-1"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                    {p.reference && <span className="text-gray-400 text-xs mt-1 font-mono">Mã GD: {p.reference}</span>}
                  </div>
                ))}
                {change > 0 && <div className="flex justify-between text-green-400 text-sm px-2 pt-2 border-t border-gray-700"><span>Tiền thối lại khách:</span><span className="font-bold text-lg">{formatCurrency(change)}</span></div>}
              </div>
            )}

            {remaining > 0 && totalPaid > 0 && <div className="flex justify-between text-amber-400 text-sm mb-3 px-1"><span>Còn thiếu:</span><span className="font-bold">{formatCurrency(remaining)}</span></div>}
          </div>

          <div className="p-4 border-t border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { holdCart(); toast('Đã lưu tạm', { icon: '💾' }); }} className="flex items-center justify-center gap-2 bg-amber-600/20 text-amber-500 hover:bg-amber-600 hover:text-white border border-amber-600/50 rounded-xl py-2.5 text-sm font-medium transition-all">
                <Clock className="w-4 h-4" /> Lưu tạm <span className="pos-key bg-transparent border border-current opacity-70 text-[10px]">F2</span>
              </button>
              <button onClick={clearCart} className="flex items-center justify-center gap-2 bg-gray-800 text-gray-400 hover:bg-red-500/20 hover:text-red-400 border border-gray-600 hover:border-red-500/50 rounded-xl py-2.5 text-sm font-medium transition-all">
                <Trash2 className="w-4 h-4" /> Xóa giỏ
              </button>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={items.length === 0 || !currentShift || remaining > 0}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl py-4 text-lg font-bold transition-all shadow-lg shadow-primary-900/50"
            >
              THANH TOÁN (F1) <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ XÁC NHẬN THANH TOÁN ══ */}
      {showCheckout && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 flex overflow-hidden max-h-[90vh]">
            <div className="flex-1 flex flex-col border-r border-gray-100">
              <div className="p-5 border-b flex items-center justify-between bg-gray-50"><h3 className="font-bold text-lg text-gray-800">Xác nhận thanh toán</h3></div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                  {items.map(i => <div key={i.productId} className="flex justify-between text-sm"><span className="text-gray-600 truncate flex-1 mr-3">{i.productName} × {i.quantity}</span><span className="text-gray-800 font-medium">{formatCurrency(i.subtotal)}</span></div>)}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-gray-500 text-sm"><span>Tổng tiền hàng</span><span>{formatCurrency(totalAmount())}</span></div>
                  {discountAmount() > 0 && <div className="flex justify-between text-green-600 text-sm"><span>Giảm giá điểm ({pointsToUse} đ.)</span><span>-{formatCurrency(discountAmount())}</span></div>}
                  <div className="flex justify-between text-xl font-black border-t border-gray-200 pt-3 mt-3"><span>KHÁCH PHẢI TRẢ</span><span className="text-primary-600">{formatCurrency(finalAmount())}</span></div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 mt-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Đã nhận của khách</p>
                  {payments.map(p => (
                    <div key={p.method} className="flex justify-between text-sm">
                      <div className="flex flex-col"><span className="text-gray-700 font-medium">{PAYMENT_METHODS.find(m => m.id === p.method)?.label}</span>{p.reference && <span className="text-gray-400 text-[10px] font-mono">Mã GD: {p.reference}</span>}</div>
                      <span className="font-bold text-gray-900">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                  {change > 0 && <div className="flex justify-between text-green-600 text-sm font-black border-t border-gray-200 pt-2 mt-2"><span>Tiền thối lại</span><span>{formatCurrency(change)}</span></div>}
                </div>
              </div>
            </div>

            <div className="w-80 bg-gray-50 flex flex-col">
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                {hasQRPayment ? (
                  <div className="w-full flex flex-col items-center animate-in zoom-in duration-300">
                    <p className="text-sm font-bold text-gray-600 mb-4">Vui lòng quét mã để thanh toán</p>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-4"><QrCode className="w-40 h-40 text-gray-800" /></div>
                    <p className="text-2xl font-black text-primary-600 mb-1">{formatCurrency(finalAmount())}</p>
                    <p className="text-xs text-gray-500">Mã QR sẽ tự động cập nhật trạng thái</p>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center opacity-60"><Banknote className="w-24 h-24 text-gray-400 mb-4" /><p className="text-gray-500 text-sm">Thanh toán tiền mặt/Thẻ</p></div>
                )}
              </div>
              <div className="p-5 border-t border-gray-200 bg-white grid grid-cols-2 gap-3">
                <button onClick={() => setShowCheckout(false)} className="btn-secondary py-3">Quay lại</button>
                <button onClick={() => checkoutMut.mutate()} disabled={checkoutMut.isPending || payments.length === 0 || remaining > 0} className="btn-primary py-3">{checkoutMut.isPending ? <Spinner size="sm" /> : 'Hoàn tất'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL HÓA ĐƠN & CÁC MODAL CÒN LẠI GIỮ NGUYÊN ══ */}
      {showInvoice && lastInvoice && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-in slide-in-from-bottom-4">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-500" /></div>
              <h3 className="font-bold text-xl text-gray-900">Thanh toán thành công!</h3><p className="text-gray-500 text-sm mt-1 font-mono">#{lastInvoice.code}</p>
            </div>
            <div className="p-6 space-y-4 text-sm bg-gray-50">
              <div className="flex justify-between items-center"><span className="text-gray-600">Tổng tiền thu</span><span className="font-black text-xl text-primary-600">{formatCurrency(lastInvoice.finalAmount)}</span></div>
              {lastInvoice.pointsEarned > 0 && <div className="flex justify-between items-center py-2 px-3 bg-green-100/50 rounded-lg text-green-700 border border-green-200"><span className="font-medium">Điểm thưởng KH</span><span className="font-bold">+{lastInvoice.pointsEarned} điểm</span></div>}
            </div>
            <div className="p-5 bg-white rounded-b-2xl flex gap-3">
              <button onClick={() => window.print()} className="btn-secondary flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0">🖨️ In Hóa Đơn</button>
              <button onClick={() => setShowInvoice(false)} className="btn-primary flex-1 py-3">Đơn Mới</button>
            </div>
          </div>
        </div>
      )}

      {showRecallModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between shrink-0"><h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Các đơn lưu tạm</h3><button onClick={() => setShowRecallModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-full"><X className="w-5 h-5" /></button></div>
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-3">
              {savedCarts?.map(cart => (
                <div key={cart.id} onClick={() => { recallCart(cart.id); setShowRecallModal(false); }} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-gray-50 hover:bg-blue-50 cursor-pointer">
                  <div><p className="font-bold text-gray-800 text-sm">{cart.customer ? cart.customer.fullName : 'Khách lẻ'}</p><p className="text-xs text-gray-500">{cart.items.length} SP • {new Date(cart.timestamp).toLocaleTimeString('vi-VN')}</p></div>
                  <div className="text-right"><p className="font-bold text-primary-600">{formatCurrency(cart.items.reduce((sum, i) => sum + i.subtotal, 0))}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-blue-50 rounded-t-2xl"><h3 className="font-bold text-lg text-blue-800 flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Trả hàng / Hoàn tiền</h3><button onClick={() => setShowRefundModal(false)} className="text-blue-400 hover:text-blue-600 bg-white rounded-full p-1.5"><X className="w-5 h-5"/></button></div>
            <div className="p-5 overflow-y-auto">
              {!invoiceToRefund ? (
                <div className="space-y-4">
                  <label className="label">Mã hóa đơn gốc (VD: INV-...)</label>
                  <div className="flex gap-2">
                    <input type="text" className="input flex-1" value={searchInvoiceCode} onChange={(e) => setSearchInvoiceCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchInvoiceMut.mutate(searchInvoiceCode)} />
                    <button onClick={() => searchInvoiceMut.mutate(searchInvoiceCode)} className="btn-primary px-6">{searchInvoiceMut.isPending ? <Spinner size="sm" /> : 'Tìm'}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-left text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-gray-100"><tr><th className="p-2">SP</th><th className="p-2 text-center">Đã mua</th><th className="p-2 text-center w-32">SL Trả</th></tr></thead>
                    <tbody className="divide-y">{invoiceToRefund.items.map(item => (
                      <tr key={item.productId}><td className="p-2">{item.productId.slice(0,8)}...</td><td className="p-2 text-center">{item.quantity}</td><td className="p-2"><input type="number" min={0} max={item.quantity} className="input text-center text-red-600" value={refundItems[item.productId] ?? 0} onChange={(e) => { const val = parseInt(e.target.value) || 0; setRefundItems(prev => ({ ...prev, [item.productId]: Math.min(val, item.quantity) })); }} /></td></tr>
                    ))}</tbody>
                  </table>
                  <div><label className="label">Xử lý kho</label><select className="input" value={returnDestination} onChange={e => setReturnDestination(e.target.value)}><option value="STOCK">Vào kho bán</option><option value="DEFECT">Vào kho lỗi</option></select></div>
                </div>
              )}
            </div>
            {invoiceToRefund && (
              <div className="p-5 border-t bg-gray-50 flex items-center justify-between rounded-b-2xl">
                <div><span className="text-gray-600 text-sm">Tổng tiền hoàn lại:</span><span className="ml-2 font-bold text-red-600 text-lg">{formatCurrency(refundTotalAmount)}</span></div>
                <div className="flex gap-3"><button onClick={() => setInvoiceToRefund(null)} className="btn-secondary">Tìm lại</button><button onClick={() => submitRefundMut.mutate()} disabled={submitRefundMut.isPending || refundTotalAmount <= 0} className="btn-danger">Xác nhận hoàn tiền</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-500" /> Lịch sử ca</h3><button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1.5"><X className="w-5 h-5" /></button></div>
            <div className="p-5 overflow-y-auto flex-1 bg-gray-50">
              {loadingHistory ? <div className="flex justify-center py-10"><Spinner size="md" /></div> : (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600"><tr><th className="p-3">Mã HĐ</th><th className="p-3">Loại</th><th className="p-3 text-right">Tổng tiền</th><th className="p-3 text-center">Thao tác</th></tr></thead>
                  <tbody className="divide-y">{shiftHistoryData?.content?.map((inv: any) => (
                    <tr key={inv.id}><td className="p-3 font-mono text-primary-600">{inv.code}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.type === 'RETURN' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{inv.type}</span></td><td className="p-3 text-right font-bold">{formatCurrency(inv.finalAmount)}</td><td className="p-3 text-center"><button onClick={() => printInvoiceMut.mutate(inv.id)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs">In lại</button></td></tr>
                  ))}</tbody></table>
                </div>
              )}
            </div>
            {shiftHistoryData?.totalPages > 1 && (
              <div className="p-4 border-t flex justify-between items-center"><span className="text-sm text-gray-500">Trang {shiftHistoryData.page + 1}/{shiftHistoryData.totalPages}</span><div className="flex gap-2"><button onClick={() => setHistoryPage(p => p - 1)} disabled={shiftHistoryData.page === 0} className="btn-secondary btn-sm px-3">‹</button><button onClick={() => setHistoryPage(p => p + 1)} disabled={shiftHistoryData.page >= shiftHistoryData.totalPages - 1} className="btn-secondary btn-sm px-3">›</button></div></div>
            )}
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-5 border-b"><h3 className="font-bold text-lg">Đóng ca làm việc</h3><p className="text-gray-500 text-sm mt-1">⚠️ Đếm thực tế tiền mặt trong két</p></div>
            <div className="p-5 space-y-4">
              <div><label className="label">Tiền mặt thực đếm (VNĐ) *</label><input type="number" className="input" value={reportedCash} onChange={e => setReportedCash(e.target.value)} autoFocus /></div>
              <div><label className="label">Lý do chênh lệch (nếu có)</label><textarea className="input" rows={2} value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} /></div>
            </div>
            <div className="p-5 border-t flex gap-3"><button onClick={() => setShowCloseShift(false)} className="btn-secondary flex-1">Hủy</button><button onClick={() => closeShiftMut.mutate()} disabled={closeShiftMut.isPending || !reportedCash} className="btn-danger flex-1">{closeShiftMut.isPending ? <Spinner size="sm" /> : 'Xác nhận đóng ca'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}