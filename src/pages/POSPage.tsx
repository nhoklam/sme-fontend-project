import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import {
  Search, X, Lock, CheckCircle, Package, ScanLine, Smartphone,
  Clock, RefreshCcw, Tag, Minus, Plus, Trash2, Banknote, CreditCard, ChevronRight, ChevronLeft, User, Gift, Wallet, ArrowRight
} from 'lucide-react';

import { posService } from '@/services/pos.service';
import { productService } from '@/services/product.service';
import { inventoryService } from '@/services/inventory.service';
import { useAuthStore } from '@/stores/auth.store';
import { usePOSStore } from '@/stores/pos.store';
import { formatCurrency, getErrorMessage, formatDateTime } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { POSPrintTemplate } from './POSPrintTemplate';
import BarcodeScanner from '@/components/BarcodeScanner';
import CustomerSelectModal from '@/components/CustomerSelectModal';

import type { CartItem, InvoiceResponse } from '@/types';

export default function POSPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const {
    currentShift, setCurrentShift,
    items, customer, pointsToUse,
    addItem, updateQuantity, removeItem, updateUnitPrice,
    setCustomer, setPointsToUse,
    clearCart,
    totalAmount, discountAmount, finalAmount,
  } = usePOSStore();

  // --- MOBILE FIRST UI STATES ---
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // --- SHIFT STATES ---
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [reportedCash, setReportedCash] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  
  // --- INVOICE STATES ---
  const [lastInvoice, setLastInvoice] = useState<InvoiceResponse | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `Hoa_Don_${lastInvoice?.code || 'POS'}` });

  // --- PRODUCTS SEARCH ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isWholesale, setIsWholesale] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  // --- PAYMENT STATES ---
  const [activePayMethod, setActivePayMethod] = useState<'CASH' | 'MOMO' | 'BANK'>('CASH');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- QUERIES ---
  const { data: suggestions, isFetching: isSearching } = useQuery({
    queryKey: ['pos-search', debouncedSearch],
    queryFn: () => productService.getProducts({ keyword: debouncedSearch, size: 15, isActive: true }).then(r => r.data.data.content),
    enabled: debouncedSearch.length > 1,
  });

  const { data: branchInventory } = useQuery({
    queryKey: ['pos-inventory', currentShift?.warehouseId || user?.warehouseId],
    queryFn: () => inventoryService.searchInventory(currentShift?.warehouseId || user?.warehouseId!, { page: 0, size: 1000 }).then((r: any) => r.data.data.content),
    enabled: !!(currentShift?.warehouseId || user?.warehouseId),
  });

  // --- TÍNH TOÁN DỮ LIỆU GỢI Ý & TỒN KHO ---
  const displaySuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.map((p: any) => {
      const inv = branchInventory?.find((i: any) => i.productId === p.id);
      return { ...p, branchQuantity: inv?.availableQuantity || 0 };
    });
  }, [suggestions, branchInventory]);

  const { data: shiftData } = useQuery({
    queryKey: ['current-shift'],
    queryFn: () => posService.getCurrentShift().then(r => r.data.data),
    retry: false,
  });

  useEffect(() => {
    if (shiftData !== undefined) setCurrentShift(shiftData);
  }, [shiftData, setCurrentShift]);

  // --- MUTATIONS ---
  const openShiftMut = useMutation({
    mutationFn: () => posService.openShift({ startingCash: parseFloat(startingCash) || 0 }),
    onSuccess: (res) => { setCurrentShift(res.data.data); setShowOpenShift(false); setStartingCash(''); toast.success('Mở ca thành công!'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

    const closeShiftMut = useMutation({
    mutationFn: () => posService.closeShift({ reportedCash: parseFloat(reportedCash) || 0, discrepancyReason: discrepancyReason || undefined }),
    onSuccess: (res) => { setCurrentShift(res.data.data); setShowCloseShift(false); toast.success('Đóng ca thành công! Chờ Quản lý duyệt.'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const scanMut = useMutation({
    mutationFn: async (code: string) => {
      const cleanCode = code.trim();
      const res = await productService.getProducts({ keyword: cleanCode, size: 5, isActive: true });
      const products = res.data.data.content;
      
      if (!products || products.length === 0) throw new Error('Not found');
      
      const exactMatch = products.find((p: any) => p.isbnBarcode === cleanCode || p.sku === cleanCode);
      return exactMatch || products[0];
    },
    onSuccess: (product) => {
      handleAddToCart(product);
      try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
    },
    onError: () => { toast.error('Không tìm thấy sản phẩm có mã này!'); setSearchTerm(''); },
  });

  const checkoutMut = useMutation({
    mutationFn: () => {
      let mappedMethod = activePayMethod === 'BANK' ? 'VNPAY' : activePayMethod;
      const paymentPayload = [{ method: mappedMethod, amount: finalAmount() }];

      return posService.checkout({
        shiftId: currentShift!.id, 
        customerId: customer?.id,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
        payments: paymentPayload,
        pointsToUse: pointsToUse || undefined, 
      }).then(r => r.data.data);
    },
    onSuccess: (invoice) => {
      setLastInvoice(invoice); setShowInvoice(true); setIsCartOpen(false); clearCart(); 
      toast.success(`Thanh toán thành công!`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // --- HANDLERS ---
  const handleAddToCart = (product: any) => {
    const branchQty = branchInventory?.find((i: any) => i.productId === product.id)?.availableQuantity || product.availableQuantity || 0;
    if (branchQty <= 0) toast('Sản phẩm báo hết hàng trong kho!', { icon: '⚠️', style: { color: '#d97706' } });

    const appliedPrice = isWholesale ? (product.wholesalePrice ?? product.retailPrice) : product.retailPrice;
    const cartItem: CartItem = {
      productId: product.id, productName: product.name, isbnBarcode: product.isbnBarcode,
      quantity: 1, unitPrice: appliedPrice, macPrice: product.macPrice, subtotal: appliedPrice,
      imageUrl: product.imageUrl, unit: product.unit || 'Cái',
    };
    addItem(cartItem);
    setSearchTerm('');
    setShowSuggestions(false);
    toast.success(`Đã thêm: ${product.name}`, { duration: 1000, position: 'top-center' });
  };

  const handleScanSuccess = (barcode: string) => {
    setIsScanning(false);
    scanMut.mutate(barcode);
  };

  const handleCheckoutSubmit = async () => {
    if (items.length === 0) return;
    if (activePayMethod === 'MOMO' || activePayMethod === 'BANK') {
        const confirmed = window.confirm(`Xác nhận: Khách hàng ĐÃ CHUYỂN KHOẢN ${formatCurrency(finalAmount())} thành công?`);
        if (!confirmed) return; 
    }
    checkoutMut.mutate();
  };

  // ==========================================
  // VIEW 1: CHƯA MỞ CA
  // ==========================================
  if (!currentShift || currentShift.status !== 'OPEN') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50/50 p-4 font-sans relative">
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-100 font-bold transition-all hover:shadow-md z-10"
        >
          <ChevronLeft className="w-5 h-5" /> Về Menu Hệ Thống
        </button>

        {!showOpenShift ? (
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-indigo-100/50">
              <Lock className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Két tiền đang khóa</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium px-4">Vui lòng mở ca để hệ thống bắt đầu ghi nhận doanh thu bán hàng.</p>
            <button onClick={() => setShowOpenShift(true)} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-bold text-[15px] shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 transition-all active:scale-95">
              Bắt đầu Ca làm việc
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 animate-scale-in">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100/80 pb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Wallet className="w-5 h-5"/></div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">Khai báo đầu ca</h3>
            </div>
            <div className="mb-8">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 block">Tiền mặt có sẵn trong két (VNĐ) *</label>
              <input 
                type="number" 
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 text-2xl font-black text-center text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all shadow-inner" 
                placeholder="0" 
                value={startingCash} 
                onChange={e => setStartingCash(e.target.value)} 
                autoFocus 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpenShift(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={() => openShiftMut.mutate()} disabled={openShiftMut.isPending} className="flex-[2] py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 transition-all flex justify-center items-center disabled:opacity-50">
                {openShiftMut.isPending ? <Spinner size="sm" className="text-white" /> : 'Xác nhận mở ca'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MÀN HÌNH POS (MOBILE FIRST FULL SCREEN)
  // ==========================================
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-800 z-50 fixed inset-0">
      
      {/* ── 1. MAIN ÁREA (LEFT ON DESKTOP, FULL ON MOBILE) ── */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isCartOpen ? 'lg:mr-[400px] xl:mr-[450px]' : ''}`}>
        
        {/* HEADER CỐ ĐỊNH */}
        <div className="bg-white shadow-[0_2px_10px_rgb(0,0,0,0.02)] z-20 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/dashboard')} 
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
                title="Quay lại hệ thống"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">POS</span>
                  <span className="text-sm font-bold text-slate-900 tracking-tight">{user?.warehouseName || 'Bán hàng tại quầy'}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">Ca ID: {currentShift.id.slice(0,8)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowCloseShift(true)} 
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Đóng ca</span>
            </button>
          </div>

          {/* THANH TÌM KIẾM & TOOLBAR */}
          <div className="px-4 py-3 flex gap-2 sm:gap-3 items-center bg-slate-50/50">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm tên sản phẩm, mã Barcode / SKU..." 
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-[15px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
              />
              {isSearching && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500" />}
              
              {/* SUGGESTIONS DROPDOWN */}
              {showSuggestions && searchTerm.length > 1 && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl max-h-[50vh] overflow-y-auto z-50 animate-scale-in">
                  {displaySuggestions.length === 0 && !isSearching ? (
                    <div className="p-6 text-center text-slate-500 text-sm font-medium">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
                      Không tìm thấy sản phẩm phù hợp
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {displaySuggestions.map((p: any) => (
                        <div key={p.id} onClick={() => handleAddToCart(p)} className="flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer transition-colors group">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-12 h-12 bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                               {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/> : <Package className="w-5 h-5 text-slate-300"/>}
                             </div>
                             <div className="overflow-hidden">
                               <p className="font-bold text-[14px] text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">{p.name}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-500">{p.isbnBarcode || p.sku}</span>
                                 <span className={`text-[10px] font-bold ${p.branchQuantity > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Tồn: {p.branchQuantity}</span>
                               </div>
                             </div>
                          </div>
                          <div className="text-right shrink-0 pl-3">
                            <p className="font-black text-indigo-600 text-[15px] tracking-tight">{formatCurrency(isWholesale ? (p.wholesalePrice ?? p.retailPrice) : p.retailPrice)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsScanning(true)} 
              className="bg-white text-slate-700 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm shrink-0"
              title="Quét mã vạch (Camera)"
            >
               <ScanLine className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsWholesale(!isWholesale)} 
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center transition-all shadow-sm shrink-0 min-w-[3.5rem] ${isWholesale ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              title="Chuyển đổi giá Sỉ / Lẻ"
            >
              <Tag className="w-4 h-4 mb-0.5"/> 
              <span className="text-[9px] font-bold uppercase tracking-wider">{isWholesale ? 'Giá Sỉ' : 'Giá Lẻ'}</span>
            </button>
          </div>
        </div>

        {/* 2. DANH SÁCH MÓN ĐÃ CHỌN (CART ITEMS) */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-3 sm:p-4 custom-scrollbar pb-[120px] lg:pb-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <p className="font-bold text-lg text-slate-600">Đơn hàng trống</p>
              <p className="text-sm font-medium mt-1 text-slate-500">Tìm kiếm hoặc quét mã để thêm sản phẩm</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-3xl p-3.5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col gap-3 animate-scale-in">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover"/> : <Package className="w-6 h-6 text-slate-200"/>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-[14px] leading-snug text-slate-800 line-clamp-2">{item.productName}</p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono font-semibold">{item.isbnBarcode}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-black text-indigo-600 text-base tracking-tight">{formatCurrency(item.subtotal)}</p>
                      
                      {editingPriceId === item.productId ? (
                        <input 
                          type="number" 
                          autoFocus 
                          defaultValue={item.unitPrice} 
                          onBlur={(e) => { updateUnitPrice(item.productId, parseInt(e.target.value) || item.unitPrice); setEditingPriceId(null); }} 
                          className="w-24 text-xs font-bold text-right border-b-2 border-indigo-500 bg-indigo-50 px-1 py-0.5 outline-none mt-1 rounded-t" 
                        />
                      ) : (
                        <p 
                          className="text-xs font-bold text-slate-400 mt-1 cursor-pointer underline decoration-dashed hover:text-indigo-500 transition-colors" 
                          onClick={() => setEditingPriceId(item.productId)}
                        >
                          {formatCurrency(item.unitPrice)}/{item.unit}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <button 
                      onClick={() => removeItem(item.productId)} 
                      className="p-2.5 text-rose-500 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    {/* Quantity Controls - Pill shape */}
                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200/80 p-1 shadow-sm">
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-10 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg transition-colors"><Minus className="w-4 h-4" /></button>
                      <div className="w-12 text-center font-black text-[15px] text-slate-800">{item.quantity}</div>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-10 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR (MÀN HÌNH NHỎ) */}
        {!isCartOpen && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-[0_-10px_30px_rgb(0,0,0,0.08)] z-30 flex justify-between items-center lg:hidden rounded-t-3xl">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng đơn ({items.reduce((a,b)=>a+b.quantity,0)} SP)</span>
              <span className="text-2xl font-black text-indigo-600 tracking-tight">{formatCurrency(finalAmount())}</span>
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              disabled={items.length === 0}
              className="bg-indigo-600 disabled:bg-slate-300 disabled:shadow-none text-white px-6 sm:px-8 py-3.5 rounded-2xl font-bold text-[15px] shadow-[0_4px_12px_rgb(99,102,241,0.3)] active:scale-95 transition-all flex items-center gap-2"
            >
              Thanh toán <ArrowRight className="w-5 h-5"/>
            </button>
          </div>
        )}
      </div>

      {/* ── 3. KHU VỰC THANH TOÁN (PAYMENT PANEL) ── */}
      {/* Trên Mobile: Trượt từ dưới lên hoặc phải sang. Trên Desktop: Cố định bên phải */}
      <div className={`
        fixed inset-y-0 right-0 z-40 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out border-l border-slate-100
        w-full md:w-[400px] xl:w-[450px]
        ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:block'}
      `}>
        {/* Header Panel (Mobile only) */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 lg:hidden shrink-0 bg-white">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Xác nhận thanh toán</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-full transition-colors border border-slate-200">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/30">
          
          {/* KHÁCH HÀNG */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Khách hàng thành viên</h3>
            {customer ? (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 relative shadow-sm">
                <button onClick={() => setCustomer(null)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 bg-white rounded-full p-1.5 shadow-sm border border-blue-50 transition-colors"><X className="w-4 h-4"/></button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 font-bold border border-blue-100 shadow-sm shrink-0">
                    {customer.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-extrabold text-blue-900 text-[15px]">{customer.fullName}</p>
                    <p className="text-[13px] font-semibold text-blue-700/80">{customer.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-3 flex justify-between items-center border border-blue-50 shadow-sm">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Điểm tích lũy</span>
                     <span className="text-[13px] font-black text-slate-700">{customer.loyaltyPoints}</span>
                   </div>
                   {customer.loyaltyPoints >= 500 && (
                     <button onClick={() => setPointsToUse(pointsToUse === 500 ? 0 : 500)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${pointsToUse === 500 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                       {pointsToUse === 500 ? 'Đã dùng 50k' : 'Dùng 50k (-500đ)'}
                     </button>
                   )}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full flex items-center justify-between p-5 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl text-indigo-700 hover:bg-indigo-50 transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform"><User className="w-5 h-5 text-indigo-500"/></div>
                  <span className="font-bold text-[14px]">Tìm / Thêm Khách Hàng</span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-50"/>
              </button>
            )}
          </div>

          {/* TÓM TẮT TIỀN */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 space-y-4">
             <div className="flex justify-between items-center text-slate-500 text-sm font-medium">
               <span>Tổng tiền hàng ({items.reduce((a,b)=>a+b.quantity,0)} SP)</span>
               <span className="font-bold text-slate-700">{formatCurrency(totalAmount())}</span>
             </div>
             {discountAmount() > 0 && (
               <div className="flex justify-between items-center text-emerald-600 text-sm font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100/50">
                 <span className="flex items-center gap-1.5"><Gift className="w-4 h-4"/> Giảm giá (Điểm)</span>
                 <span>-{formatCurrency(discountAmount())}</span>
               </div>
             )}
             <div className="flex justify-between items-end pt-4 border-t border-slate-100 mt-2">
               <span className="font-bold text-slate-900 text-base uppercase tracking-wider">Khách phải trả</span>
               <span className="text-3xl font-black text-indigo-600 tracking-tight leading-none">{formatCurrency(finalAmount())}</span>
             </div>
          </div>

          {/* PHƯƠNG THỨC THANH TOÁN */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hình thức thanh toán</h3>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setActivePayMethod('CASH')} className={`py-4 rounded-2xl font-bold text-[13px] border-2 flex flex-col items-center gap-2 transition-all ${activePayMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                <Banknote className={`w-6 h-6 ${activePayMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-400'}`}/> Tiền mặt
              </button>
              <button onClick={() => setActivePayMethod('MOMO')} className={`py-4 rounded-2xl font-bold text-[13px] border-2 flex flex-col items-center gap-2 transition-all ${activePayMethod === 'MOMO' ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                <Smartphone className={`w-6 h-6 ${activePayMethod === 'MOMO' ? 'text-pink-600' : 'text-slate-400'}`}/> MoMo
              </button>
              <button onClick={() => setActivePayMethod('BANK')} className={`py-4 rounded-2xl font-bold text-[13px] border-2 flex flex-col items-center gap-2 transition-all ${activePayMethod === 'BANK' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}>
                <CreditCard className={`w-6 h-6 ${activePayMethod === 'BANK' ? 'text-blue-600' : 'text-slate-400'}`}/> Thẻ / QR
              </button>
            </div>

            {(activePayMethod === 'MOMO' || activePayMethod === 'BANK') && finalAmount() > 0 && (
              <div className="mt-6 flex flex-col items-center animate-scale-in">
                <div className="p-3 bg-white border border-slate-200 rounded-3xl shadow-sm mb-4">
                  <img 
                    src={`https://img.vietqr.io/image/${activePayMethod === 'MOMO' ? 'momo' : '970436'}-0933939339-compact.png?amount=${finalAmount()}&addInfo=ThanhToanPOS&accountName=SME%20STORE`} 
                    alt="Payment QR" 
                    className="w-48 h-48 object-contain rounded-2xl"
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200/60 text-amber-700 p-4 rounded-2xl text-[13px] font-medium text-center shadow-sm w-full">
                  <strong className="block mb-1">Đưa mã QR này cho khách quét.</strong>
                  Vui lòng kiểm tra biến động số dư trước khi chốt đơn!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NÚT CHỐT ĐƠN CỐ ĐỊNH DƯỚI CÙNG PANEL */}
        <div className="p-5 bg-white border-t border-slate-100 shrink-0 z-10 shadow-[0_-4px_24px_rgb(0,0,0,0.02)]">
          <button 
             onClick={handleCheckoutSubmit}
             disabled={items.length === 0 || checkoutMut.isPending}
             className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-[16px] shadow-[0_4px_12px_rgb(99,102,241,0.3)] active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none transition-all flex justify-center items-center gap-2"
          >
             {checkoutMut.isPending ? <Spinner size="md" className="text-white"/> : 'Hoàn tất & In Bill'}
          </button>
        </div>
      </div>

      {/* --- CÁC MODALS OVERLAY --- */}
      {isScanning && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
      
      {isCustomerModalOpen && (
        <div className="z-[100] relative">
          <CustomerSelectModal onSelect={(c) => { setCustomer(c); setIsCustomerModalOpen(false); }} onClose={() => setIsCustomerModalOpen(false)} />
        </div>
      )}
      
      {/* MODAL THÀNH CÔNG */}
      {showInvoice && lastInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full animate-scale-in overflow-hidden border border-slate-100">
            <div className="bg-emerald-500 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-3 relative z-10" />
              <h3 className="font-extrabold text-3xl text-white tracking-tight relative z-10">Thành công!</h3>
              <p className="text-emerald-100 text-sm font-mono mt-1.5 font-semibold bg-black/10 inline-block px-3 py-1 rounded-full relative z-10">#{lastInvoice.code}</p>
            </div>
            <div className="p-8 bg-slate-50/30 text-center">
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Đã thanh toán</p>
               <p className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(lastInvoice.finalAmount)}</p>
               {(lastInvoice.pointsEarned ?? 0) > 0 && (
                 <div className="mt-5 bg-amber-50 text-amber-700 text-[13px] font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 inline-flex border border-amber-200/60 shadow-sm">
                   <Gift className="w-4 h-4"/> Khách được cộng +{lastInvoice.pointsEarned} điểm
                 </div>
               )}
            </div>
            <div className="p-5 bg-white flex gap-3 border-t border-slate-100">
              <button onClick={() => handlePrint()} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">In lại Bill</button>
              <button onClick={() => setShowInvoice(false)} className="flex-[2] py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 transition-all">Đơn Mới</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐÓNG CA */}
      {showCloseShift && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full animate-scale-in overflow-hidden border border-slate-100">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <div className="p-2.5 bg-rose-200 text-rose-700 rounded-xl shadow-sm"><Lock className="w-5 h-5"/></div>
              <div>
                <h3 className="font-extrabold text-xl text-rose-900 tracking-tight mb-0.5">Đóng ca làm việc</h3>
                <p className="text-rose-700/80 text-xs font-semibold">⚠️ Hãy đếm tiền thực tế trong két</p>
              </div>
            </div>
            <div className="p-8 space-y-6 bg-slate-50/30">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tiền mặt thực đếm (VNĐ) *</label>
                <input 
                  type="number" 
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-2xl font-black text-center text-slate-900 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 outline-none transition-all shadow-inner" 
                  placeholder="0" 
                  value={reportedCash} 
                  onChange={e => setReportedCash(e.target.value)} 
                  autoFocus 
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Ghi chú nếu có chênh lệch</label>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none resize-none text-[14px] shadow-sm font-medium" 
                  rows={3} 
                  placeholder="Nhập lý do dư/thiếu tiền..." 
                  value={discrepancyReason} 
                  onChange={e => setDiscrepancyReason(e.target.value)} 
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-white flex gap-3">
              <button onClick={() => setShowCloseShift(false)} className="flex-1 py-3.5 bg-slate-100 border border-transparent text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={() => closeShiftMut.mutate()} disabled={closeShiftMut.isPending || !reportedCash} className="flex-[2] py-3.5 bg-rose-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgb(225,29,72,0.3)] hover:bg-rose-700 transition-all flex justify-center items-center disabled:opacity-50">
                {closeShiftMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận đóng ca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component Print Ẩn */}
      <div className="hidden">
        <POSPrintTemplate ref={printRef} invoice={lastInvoice} />
      </div>

    </div>
  );
}