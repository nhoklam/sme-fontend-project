import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import {
  Search, X, Lock, CheckCircle, Package, ScanLine, Smartphone,
  Clock, RefreshCcw, Tag, Minus, Plus, Trash2, Banknote, CreditCard, 
  ChevronRight, ChevronLeft, User, Gift, Bot, Sparkles, MessageSquare, Send
} from 'lucide-react';

import { posService } from '@/services/pos.service';
import { productService } from '@/services/product.service';
import { inventoryService } from '@/services/inventory.service';
import { aiService } from '@/services/ai.service'; // Đã thêm AI Service
import { useAuthStore } from '@/stores/auth.store';
import { usePOSStore } from '@/stores/pos.store';
import { formatCurrency, getErrorMessage, formatDateTime } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { POSPrintTemplate } from './POSPrintTemplate';
import BarcodeScanner from '@/components/BarcodeScanner';
import CustomerSelectModal from '@/components/CustomerSelectModal';

import type { CartItem, InvoiceResponse } from '@/types';

// ── COMPONENT AI CHATBOT THÔNG MINH CHO POS ───────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; ts: Date; }

function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Xin chào! Tôi là Trợ lý AI hệ thống SME ERP. Đang đứng quầy có vấn đề gì cần hỗ trợ không? Bạn có thể hỏi tôi về quy định đổi trả, phân tích doanh số ca này, hoặc kiểm tra thông tin hàng hóa.', ts: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, ts: new Date() }]);
    setLoading(true);
    try {
      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const res = await aiService.chat({ message: userMsg, conversationHistory: history });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.reply, ts: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, hệ thống AI đang bận. Vui lòng thử lại sau giây lát.', ts: new Date() }]);
    } finally { setLoading(false); }
  };

  const suggestions = [
    '📦 Sản phẩm nào đang bán chạy nhất?',
    '🔄 Quy định đổi trả hàng?',
    '💡 Khách quen có ưu đãi gì?',
  ];

  return (
    <div className="fixed right-4 bottom-24 lg:right-8 lg:bottom-8 z-[99] flex flex-col w-[350px] lg:w-[400px] h-[500px] lg:h-[600px] max-h-[75vh] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden animate-slide-up origin-bottom-right">
      
      {/* Header Gradient Sang trọng */}
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner border border-white/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base tracking-tight flex items-center gap-1">AI Co-pilot <Sparkles className="w-3.5 h-3.5 text-amber-300"/></h3>
            <p className="text-indigo-100 text-[10px] font-bold tracking-widest uppercase mt-0.5">Trợ lý ảo Thu Ngân</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors relative z-10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 border border-indigo-200 mt-1 shadow-sm">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-3 text-[14px] shadow-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-[20px] rounded-tr-[4px] font-medium' 
                : 'bg-white border border-slate-100 text-slate-800 rounded-[20px] rounded-tl-[4px]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start animate-fade-in">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 border border-indigo-200 mt-1 shadow-sm">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-white border border-slate-100 px-4 py-3 rounded-[20px] rounded-tl-[4px] shadow-sm flex items-center gap-1.5 h-[46px]">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area & Suggestions */}
      <div className="bg-white border-t border-slate-100 p-4 shrink-0 flex flex-col gap-3">
        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
            {suggestions.map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="shrink-0 text-[11px] font-bold bg-white text-slate-600 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 p-1.5 rounded-2xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            className="flex-1 bg-transparent text-[14px] px-3 py-2 outline-none text-slate-800 placeholder:text-slate-400 font-medium" 
            placeholder="Hỏi AI Co-pilot..." 
          />
          <button 
            onClick={send} 
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:bg-slate-300 shadow-sm"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
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
  
  // --- AI CHAT STATE ---
  const [showAI, setShowAI] = useState(false);

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
    onSuccess: (res) => { setCurrentShift(res.data.data); setShowCloseShift(false); toast.success('Đóng ca thành công! Chờ Manager duyệt.'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const scanMut = useMutation({
    mutationFn: (code: string) => productService.getByBarcode(code, currentShift?.warehouseId || user?.warehouseId).then(r => r.data.data),
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
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4 w-full">
        {/* Nút thoát để Manager/Admin có thể quay lại nếu lỡ vào */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-gray-900 bg-white px-4 py-2 rounded-xl shadow-sm font-medium transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Trở về Menu
        </button>

        {!showOpenShift ? (
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl border border-gray-100">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5"><Lock className="w-10 h-10 text-amber-600" /></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Bắt đầu ca làm việc</h2>
            <p className="text-gray-500 text-sm mb-8">Vui lòng mở ca để hệ thống ghi nhận doanh thu và kiểm soát tiền mặt.</p>
            <button onClick={() => setShowOpenShift(true)} className="w-full bg-primary-600 text-white rounded-xl py-4 font-bold text-lg shadow-md active:bg-primary-700">Mở ca mới</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-gray-100 animate-slide-up">
            <h3 className="font-bold text-xl mb-6 text-center text-gray-800">Khai báo tiền đầu ca</h3>
            <div className="mb-6">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 block">Tiền mặt trong két (VNĐ)</label>
              <input type="number" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-4 text-xl font-bold text-center focus:border-primary-500 outline-none" placeholder="0" value={startingCash} onChange={e => setStartingCash(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpenShift(false)} className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl active:bg-gray-200">Hủy</button>
              <button onClick={() => openShiftMut.mutate()} disabled={openShiftMut.isPending} className="flex-[2] py-3.5 bg-primary-600 text-white font-bold rounded-xl shadow-md active:bg-primary-700 flex justify-center items-center">
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
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden text-gray-800 font-sans z-50 relative">
      
      {/* 1. HEADER CỐ ĐỊNH & THANH TÌM KIẾM */}
      <div className="bg-white shadow-[0_2px_10px_rgb(0,0,0,0.05)] z-20 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-900 text-white">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="p-1.5 bg-gray-800 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Quay lại hệ thống"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="bg-primary-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">POS</span>
            <span className="text-sm font-medium hidden sm:block">{user?.warehouseName || 'Bán hàng'}</span>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-[10px] text-green-400 font-mono">Ca: {currentShift.id.slice(0,6)}</span>
            <button onClick={() => setShowCloseShift(true)} className="text-red-400 p-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors">
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 flex gap-2 items-center relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm tên, mã SP..." 
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-3 py-3 text-base font-medium focus:outline-none focus:border-primary-500 bg-gray-50"
            />
            {isSearching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500" />}
            
            {showSuggestions && searchTerm.length > 1 && (
              <div className="absolute top-[110%] left-0 right-0 bg-white border border-gray-200 shadow-xl rounded-xl max-h-[50vh] overflow-y-auto z-50">
                {displaySuggestions.length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Không tìm thấy sản phẩm</div>
                ) : (
                  displaySuggestions.map((p: any) => (
                    <div key={p.id} onClick={() => handleAddToCart(p)} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-primary-50 active:bg-primary-100 cursor-pointer">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                           {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/> : <Package className="w-5 h-5 m-auto mt-2.5 text-gray-400"/>}
                         </div>
                         <div>
                           <p className="font-bold text-sm line-clamp-1">{p.name}</p>
                           <p className="text-xs text-gray-500">{p.isbnBarcode}</p>
                         </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="font-black text-primary-600">{formatCurrency(isWholesale ? (p.wholesalePrice ?? p.retailPrice) : p.retailPrice)}</p>
                        <p className="text-[10px] text-gray-400">Tồn: {p.branchQuantity}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={() => setIsScanning(true)} className="bg-gray-100 text-gray-700 p-3 rounded-xl border-2 border-gray-200 active:bg-gray-200">
             <ScanLine className="w-6 h-6" />
          </button>
          <button onClick={() => setIsWholesale(!isWholesale)} className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center transition-colors ${isWholesale ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
            <Tag className="w-4 h-4 mb-0.5"/> Sỉ
          </button>
        </div>
      </div>

      {/* 2. DANH SÁCH MÓN ĐÃ CHỌN (MAIN AREA) */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-3 pb-[100px] lg:pb-3 lg:w-2/3 xl:w-3/4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
            <Package className="w-16 h-16 mb-4" />
            <p className="font-medium text-lg">Đơn hàng trống</p>
            <p className="text-sm mt-1">Tìm kiếm hoặc quét mã để thêm</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-200 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover"/> : <Package className="w-6 h-6 m-auto mt-4 text-gray-300"/>}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm leading-tight text-gray-800 line-clamp-2">{item.productName}</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono">{item.isbnBarcode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary-600 text-base">{formatCurrency(item.subtotal)}</p>
                    
                    {editingPriceId === item.productId ? (
                      <input type="number" autoFocus defaultValue={item.unitPrice} onBlur={(e) => { updateUnitPrice(item.productId, parseInt(e.target.value) || item.unitPrice); setEditingPriceId(null); }} className="w-20 text-xs text-right border-b-2 border-primary-500 outline-none mt-1" />
                    ) : (
                      <p className="text-xs text-gray-500 mt-1 cursor-pointer underline decoration-dashed" onClick={() => setEditingPriceId(item.productId)}>
                        {formatCurrency(item.unitPrice)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <button onClick={() => removeItem(item.productId)} className="p-2 text-red-500 bg-red-50 rounded-lg active:bg-red-100">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="flex items-center bg-gray-100 rounded-xl border border-gray-200 p-1">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-10 h-8 flex items-center justify-center text-gray-600 active:bg-gray-200 rounded-lg"><Minus className="w-5 h-5" /></button>
                    <div className="w-12 text-center font-black text-base">{item.quantity}</div>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-10 h-8 flex items-center justify-center text-gray-600 active:bg-gray-200 rounded-lg"><Plus className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. THANH GIỎ HÀNG NỔI (Mobile & Tablet) */}
      {!isCartOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20 flex justify-between items-center lg:hidden rounded-t-3xl">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-500 uppercase">Tổng tiền ({items.length} món)</span>
            <span className="text-2xl font-black text-primary-600">{formatCurrency(finalAmount())}</span>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)}
            disabled={items.length === 0}
            className="bg-primary-600 disabled:bg-gray-300 text-white px-8 py-3.5 rounded-2xl font-bold text-lg shadow-lg shadow-primary-200 active:scale-95 transition-all flex items-center gap-2"
          >
            Thanh toán <ChevronRight className="w-5 h-5"/>
          </button>
        </div>
      )}

      {/* 4. PANEL THANH TOÁN (Trượt từ phải sang/Dưới lên) */}
      <div className={`
        fixed inset-y-0 right-0 z-30 bg-gray-50 shadow-2xl flex flex-col transition-transform duration-300
        w-full lg:w-1/3 lg:translate-x-0 border-l border-gray-200
        ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 bg-white border-b lg:hidden">
          <h2 className="text-xl font-bold text-gray-800">Thông tin thanh toán</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-100 text-gray-600 rounded-full font-bold">✕ Đóng</button>
        </div>

        <div className="flex-1 overflow-y-auto pb-[100px] custom-scrollbar">
          {/* KHÁCH HÀNG */}
          <div className="p-4 bg-white mb-2">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-blue-500"/> Khách hàng thành viên</h3>
            {customer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 relative">
                <button onClick={() => setCustomer(null)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 bg-white rounded-full p-1"><X className="w-4 h-4"/></button>
                <p className="font-bold text-blue-900 text-lg mb-1">{customer.fullName}</p>
                <p className="text-sm text-blue-700 mb-3">{customer.phoneNumber}</p>
                <div className="bg-white rounded-lg p-2.5 flex justify-between items-center border border-blue-100">
                   <span className="text-xs font-bold text-gray-500">Tích lũy: {customer.loyaltyPoints} điểm</span>
                   {customer.loyaltyPoints >= 500 && (
                     <button onClick={() => setPointsToUse(pointsToUse === 500 ? 0 : 500)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pointsToUse === 500 ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}>
                       {pointsToUse === 500 ? 'Đã trừ 50k' : 'Dùng 500đ = -50k'}
                     </button>
                   )}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full flex items-center justify-between p-4 border-2 border-dashed border-primary-300 bg-primary-50 rounded-xl text-primary-700 hover:bg-primary-100 transition-colors active:scale-[0.98]"
              >
                <span className="font-bold">+ Gắn khách hàng (Tích điểm)</span>
                <ChevronRight className="w-5 h-5 opacity-50"/>
              </button>
            )}
          </div>

          {/* TÓM TẮT TIỀN */}
          <div className="p-4 bg-white mb-2 space-y-3">
             <div className="flex justify-between text-gray-500 text-sm font-medium">
               <span>Tổng tiền ({items.length} món)</span>
               <span>{formatCurrency(totalAmount())}</span>
             </div>
             {discountAmount() > 0 && (
               <div className="flex justify-between text-green-600 text-sm font-bold">
                 <span>Giảm giá (Điểm)</span>
                 <span>-{formatCurrency(discountAmount())}</span>
               </div>
             )}
             <div className="flex justify-between text-gray-900 text-xl font-black pt-3 border-t border-gray-100 mt-2">
               <span>Khách phải trả</span>
               <span className="text-primary-600">{formatCurrency(finalAmount())}</span>
             </div>
          </div>

          {/* PHƯƠNG THỨC THANH TOÁN */}
          <div className="p-4 bg-white min-h-[300px]">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Hình thức thanh toán</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setActivePayMethod('CASH')} className={`py-3 rounded-xl font-bold text-sm border-2 flex flex-col items-center gap-1 transition-all ${activePayMethod === 'CASH' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <Banknote className="w-6 h-6"/> Tiền mặt
              </button>
              <button onClick={() => setActivePayMethod('MOMO')} className={`py-3 rounded-xl font-bold text-sm border-2 flex flex-col items-center gap-1 transition-all ${activePayMethod === 'MOMO' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-500'}`}>
                <Smartphone className="w-6 h-6"/> MoMo
              </button>
              <button onClick={() => setActivePayMethod('BANK')} className={`py-3 rounded-xl font-bold text-sm border-2 flex flex-col items-center gap-1 transition-all ${activePayMethod === 'BANK' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-500'}`}>
                <CreditCard className="w-6 h-6"/> Thẻ / QR
              </button>
            </div>

            {(activePayMethod === 'MOMO' || activePayMethod === 'BANK') && finalAmount() > 0 && (
              <div className="mt-6 flex flex-col items-center animate-in zoom-in duration-300">
                <div className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm mb-3">
                  <img 
                    src={`https://img.vietqr.io/image/${activePayMethod === 'MOMO' ? 'momo' : '970436'}-0933939339-compact.png?amount=${finalAmount()}&addInfo=ThanhToanPOS&accountName=SME%20STORE`} 
                    alt="Payment QR" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl text-xs font-medium text-center">
                  ⚠️ Đưa mã này cho khách quét. <br/>Vui lòng kiểm tra biến động số dư trước khi chốt đơn!
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button 
             onClick={handleCheckoutSubmit}
             disabled={items.length === 0 || checkoutMut.isPending}
             className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg active:scale-95 disabled:bg-gray-300 disabled:shadow-none transition-all flex justify-center items-center gap-2"
          >
             {checkoutMut.isPending ? <Spinner size="md" className="text-white"/> : 'Hoàn tất & In Bill'}
          </button>
        </div>
      </div>

      {/* ── AI CHATBOT TOGGLE & PANEL ── */}
      {!showAI && (
        <button
          onClick={() => setShowAI(true)}
          className="fixed right-4 bottom-24 lg:right-8 lg:bottom-8 w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-[0_10px_25px_rgba(79,70,229,0.5)] flex items-center justify-center transition-transform hover:scale-110 z-[90] border-2 border-white/20"
        >
          <Bot className="w-7 h-7" />
          <span className="absolute top-0 right-0 flex h-3 w-3 lg:h-4 lg:w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 lg:h-4 lg:w-4 bg-amber-500 border-2 border-white"></span>
          </span>
        </button>
      )}
      
      {showAI && <AIChatPanel onClose={() => setShowAI(false)} />}

      {/* --- CÁC MODALS OVERLAY --- */}
      {isScanning && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
      {isCustomerModalOpen && <CustomerSelectModal onSelect={(c) => { setCustomer(c); setIsCustomerModalOpen(false); }} onClose={() => setIsCustomerModalOpen(false)} />}
      
      {showInvoice && lastInvoice && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-green-500 p-6 text-center">
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-2" />
              <h3 className="font-bold text-2xl text-white">Thành công!</h3>
              <p className="text-green-100 text-sm font-mono mt-1">#{lastInvoice.code}</p>
            </div>
            <div className="p-6 bg-gray-50 text-center">
               <p className="text-gray-500 text-sm mb-1">Khách đã thanh toán</p>
               <p className="text-3xl font-black text-gray-900">{formatCurrency(lastInvoice.finalAmount)}</p>
               {(lastInvoice.pointsEarned ?? 0) > 0 && (
                 <div className="mt-4 bg-yellow-100 text-yellow-800 text-sm font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 inline-flex border border-yellow-200">
                   <Gift className="w-4 h-4"/> Khách được cộng +{lastInvoice.pointsEarned} điểm
                 </div>
               )}
            </div>
            <div className="p-4 bg-white flex gap-3">
              <button onClick={() => handlePrint()} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200">In lại Bill</button>
              <button onClick={() => setShowInvoice(false)} className="flex-[2] py-3.5 bg-primary-600 text-white font-bold rounded-xl shadow-md active:bg-primary-700">Đơn Mới</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full animate-slide-up overflow-hidden">
            <div className="p-6 bg-rose-50 border-b border-rose-100 text-center">
              <h3 className="font-bold text-xl text-rose-800 mb-1">Đóng ca làm việc</h3>
              <p className="text-rose-600 text-sm">⚠️ Hãy đếm tiền thực tế trong két</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Tiền mặt thực đếm (VNĐ) *</label>
                <input type="number" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-4 text-xl font-bold text-center focus:border-rose-500 outline-none" value={reportedCash} onChange={e => setReportedCash(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Ghi chú nếu có chênh lệch</label>
                <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-rose-500 outline-none resize-none text-sm" rows={2} placeholder="Nhập lý do..." value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} />
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 flex gap-3">
              <button onClick={() => setShowCloseShift(false)} className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl active:bg-gray-100">Hủy</button>
              <button onClick={() => closeShiftMut.mutate()} disabled={closeShiftMut.isPending || !reportedCash} className="flex-[2] py-3.5 bg-rose-600 text-white font-bold rounded-xl shadow-md active:bg-rose-700 flex justify-center items-center">
                {closeShiftMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Đóng ca'}
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