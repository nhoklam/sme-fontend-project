/**
 * PromotionCodeInput — Component nhập mã khuyến mãi trong màn hình POS
 *
 * Tích hợp vào POSPage.tsx:
 *   1. Import component này
 *   2. Thêm vào vùng "Giảm giá" trên checkout panel, TRƯỚC phần điểm tích lũy
 *   3. Đọc promotionCode + setPromotion + clearPromotion từ usePOSStore
 *
 * Ví dụ tích hợp vào checkout panel của POSPage:
 * ─────────────────────────────────────────────
 *   import PromotionCodeInput from '@/components/pos/PromotionCodeInput';
 *
 *   // Trong JSX của checkout panel:
 *   <PromotionCodeInput orderTotal={totalAmount()} />
 * ─────────────────────────────────────────────
 */
import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Tag, X, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { promotionService } from '@/services/promotion.service';
import { usePOSStore } from '@/stores/pos.store';
import { formatCurrency, cn } from '@/lib/utils';

interface Props {
  orderTotal: number;
  disabled?: boolean;
}

export default function PromotionCodeInput({ orderTotal, disabled }: Props) {
  const { promotionCode, promotionDiscount, setPromotion, clearPromotion } = usePOSStore();
  const [inputCode, setInputCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isApplied = !!promotionCode && promotionDiscount > 0;

  const validateMut = useMutation({
    mutationFn: (code: string) =>
      promotionService.validateCode({ code, orderTotal, channel: 'POS' })
        .then(r => r.data.data),
    onSuccess: (promotion) => {
      const discount = promotion.discountAmount ?? 0;
      setPromotion(promotion.code, discount);
      toast.success(
        `✓ "${promotion.name}" — Giảm ${formatCurrency(discount)}`,
        { duration: 3000 }
      );
      setInputCode('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || 'Mã không hợp lệ hoặc đã hết hạn';
      toast.error(msg);
    },
  });

  const handleApply = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) { toast.error('Nhập mã khuyến mãi trước'); return; }
    if (orderTotal <= 0) { toast.error('Giỏ hàng đang rỗng'); return; }
    validateMut.mutate(code);
  };

  const handleRemove = () => {
    clearPromotion();
    setInputCode('');
    inputRef.current?.focus();
  };

  // Nếu đã áp dụng thành công → hiện badge thay input
  if (isApplied) {
    return (
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-800">{promotionCode}</p>
            <p className="text-[11px] text-emerald-600">
              Giảm {formatCurrency(promotionDiscount)}
            </p>
          </div>
        </div>
        <button
          onClick={handleRemove}
          disabled={disabled}
          className="p-1 text-emerald-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Xóa mã"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'w-full pl-8 pr-3 py-2 text-sm border rounded-xl outline-none uppercase font-mono tracking-wider transition-all',
            disabled
              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'
          )}
          placeholder="Nhập mã KM..."
          value={inputCode}
          onChange={e => setInputCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
          disabled={disabled || validateMut.isPending}
          maxLength={20}
        />
      </div>
      <button
        onClick={handleApply}
        disabled={disabled || validateMut.isPending || !inputCode.trim()}
        className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap flex items-center gap-1.5"
      >
        {validateMut.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          'Áp dụng'
        )}
      </button>
    </div>
  );
}
