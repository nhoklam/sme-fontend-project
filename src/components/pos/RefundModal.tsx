import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Search, RotateCcw, PackageX, PackageCheck } from 'lucide-react';
import { posService } from '@/services/pos.service';
import { usePOSStore } from '@/stores/pos.store';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import type { InvoiceResponse } from '@/types';

interface RefundModalProps {
  onClose: () => void;
}

export default function RefundModal({ onClose }: RefundModalProps) {
  const { currentShift } = usePOSStore();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [destination, setDestination] = useState<'STOCK' | 'DEFECT'>('STOCK');
  const [note, setNote] = useState('');

  const lookupMut = useMutation({
    mutationFn: (invoiceCode: string) =>
      posService.getInvoiceByCode(invoiceCode).then((r) => r.data.data),
    onSuccess: (inv) => {
      if (inv.type === 'RETURN') {
        toast.error('Đây là hóa đơn trả hàng, không thể trả lại lần nữa.');
        return;
      }
      setInvoice(inv);
      const initialQty: Record<string, number> = {};
      inv.items.forEach((i) => { initialQty[i.productId] = 0; });
      setReturnQty(initialQty);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const refundMut = useMutation({
    mutationFn: () => {
      const items = Object.entries(returnQty)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));

      return posService.refund({
        originalInvoiceId: invoice!.id,
        shiftId: currentShift!.id,
        items,
        returnDestination: destination,
        note,
      }).then((r) => r.data.data);
    },
    onSuccess: () => {
      toast.success('Trả hàng thành công!');
      qc.invalidateQueries({ queryKey: ['pos-inventory'] }); 
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const totalRefund = invoice
    ? invoice.items.reduce((sum, i) => sum + (returnQty[i.productId] || 0) * i.unitPrice, 0)
    : 0;
  const hasAnyQty = Object.values(returnQty).some((q) => q > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[120] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-500" /> Trả hàng tại quầy
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-full transition-colors border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TRA CỨU HÓA ĐƠN GỐC */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Mã hóa đơn gốc
            </label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && code.trim() && lookupMut.mutate(code.trim())}
                placeholder="VD: INV-20260714-000123"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
              <button
                onClick={() => code.trim() && lookupMut.mutate(code.trim())}
                disabled={lookupMut.isPending || !code.trim()}
                className="px-4 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CHI TIẾT + CHỌN SỐ LƯỢNG TRẢ */}
          {invoice && (
            <>
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-1 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ngày bán</span>
                  <span className="font-bold text-slate-700">
                    {new Date(invoice.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                {invoice.cashierName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thu ngân</span>
                    <span className="font-bold text-slate-700">{invoice.cashierName}</span>
                  </div>
                )}
                {invoice.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khách hàng</span>
                    <span className="font-bold text-slate-700">{invoice.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng tiền hóa đơn</span>
                  <span className="font-bold text-slate-700">{formatCurrency(invoice.finalAmount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chọn sản phẩm & số lượng trả
                </label>
                {invoice.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm"
                  >
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-[13px] text-slate-800 line-clamp-1">{item.productName}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatCurrency(item.unitPrice)} × {item.quantity} đã bán
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={returnQty[item.productId] ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0));
                        setReturnQty((prev) => ({ ...prev, [item.productId]: v }));
                      }}
                      className="w-16 text-center bg-slate-50 border border-slate-200 rounded-lg py-2 text-sm font-black focus:border-rose-500 outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Hàng trả về đâu?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDestination('STOCK')}
                    className={`py-3 rounded-xl font-bold text-xs border-2 flex flex-col items-center gap-1 transition-colors ${
                      destination === 'STOCK'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-100 bg-white text-slate-500'
                    }`}
                  >
                    <PackageCheck className="w-4 h-4" /> Nhập lại kho bán
                  </button>
                  <button
                    onClick={() => setDestination('DEFECT')}
                    className={`py-3 rounded-xl font-bold text-xs border-2 flex flex-col items-center gap-1 transition-colors ${
                      destination === 'DEFECT'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-100 bg-white text-slate-500'
                    }`}
                  >
                    <PackageX className="w-4 h-4" /> Hàng lỗi / hỏng
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Ghi chú
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Lý do trả hàng..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {invoice && (
          <div className="p-5 border-t border-slate-100 shrink-0 bg-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Số tiền hoàn</span>
              <span className="text-xl font-black text-rose-600">{formatCurrency(totalRefund)}</span>
            </div>
            <button
              onClick={() => refundMut.mutate()}
              disabled={!hasAnyQty || refundMut.isPending}
              className="w-full bg-rose-600 text-white py-3.5 rounded-2xl font-bold shadow-lg disabled:bg-slate-300 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {refundMut.isPending ? 'Đang xử lý...' : 'Xác nhận trả hàng'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}