import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Handshake, Search, Plus, X, Edit, Eye, EyeOff, Info, CreditCard, Download, Upload, Package, Building2, Phone, Mail, Landmark, FileText, CheckCircle } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';

import { supplierService } from '@/services/supplier.service';
import { financeService } from '@/services/finance.service';
import { purchaseService } from '@/services/purchase.service';
import { PageLoader, EmptyState, Spinner, Pagination } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Supplier } from '@/types';
import { PurchaseOrderDetailsModal } from './PurchaseOrderDetailsModal';

// --- CẤU HÌNH TOOLTIP CHO BIỂU ĐỒ ---
const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[160px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            <span className="text-sm font-medium text-slate-500">Số lượng:</span>
          </div>
          <span className="text-sm font-black text-slate-900">{payload[0].value} NCC</span>
        </div>
      </div>
    );
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────
// SCHEMA VALIDATION VỚI ZOD
// ─────────────────────────────────────────────────────────────────
const supplierSchema = z.object({
  name: z.string().min(1, 'Tên nhà cung cấp không được để trống'),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional().refine(val => !val || /^[0-9]{10,11}$/.test(val), {
    message: 'Số điện thoại phải từ 10-11 số',
  }),
  email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Định dạng email không hợp lệ',
  }),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  paymentTerms: z.coerce.number().min(0, 'Số ngày nợ phải >= 0'),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ─────────────────────────────────────────────────────────────────
// COMPONENT 1: MODAL CHI TIẾT & LỊCH SỬ NHẬP KHO
// ─────────────────────────────────────────────────────────────────
function SupplierDetailsModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY'>('INFO');
  const [poPage, setPoPage] = useState(0);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [fundType, setFundType] = useState<'CASH_111' | 'BANK_112'>('CASH_111');
  const [isPaying, setIsPaying] = useState(false);

  const [isPoDetailsOpen, setIsPoDetailsOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const { data: totalUnpaid = 0, isLoading: loadingTotal } = useQuery({
    queryKey: ['supplier-total-debt', supplier.id],
    queryFn: () => financeService.getTotalOutstandingBySupplier(supplier.id).then(r => r.data.data),
  });

  const { data: poData, isLoading: loadingPo } = useQuery({
    queryKey: ['supplier-po-history', supplier.id, poPage],
    queryFn: () => purchaseService.getBySupplier(supplier.id, { page: poPage, size: 5 }).then(r => r.data.data),
    enabled: activeTab === 'HISTORY',
  });

  const { data: debts, isLoading: loadingDebts } = useQuery({
    queryKey: ['supplier-unpaid-debts', supplier.id],
    queryFn: () => financeService.getOutstandingDebts().then((r: any) => r.data.data),
  });
  const myDebts = debts?.filter((d: any) => d.supplierId === supplier.id) || [];

  const handlePayDebt = async () => {
    if (!selectedDebt || !payAmount || Number(payAmount) <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (Number(payAmount) > selectedDebt.remainingAmount) {
      toast.error('Số tiền thanh toán không được vượt quá số nợ còn lại');
      return;
    }

    try {
      setIsPaying(true);
      await financeService.paySupplierDebt({
        supplierDebtId: selectedDebt.id,
        amount: Number(payAmount),
        fundType: fundType,
        note: `Thanh toán công nợ PO: ${selectedDebt.purchaseOrderCode || selectedDebt.purchaseOrderId}`
      });
      
      toast.success('Thanh toán thành công!');
      setIsPayModalOpen(false);
      setPayAmount('');
      
      qc.invalidateQueries({ queryKey: ['supplier-unpaid-debts'] });
      qc.invalidateQueries({ queryKey: ['supplier-total-debt'] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi thanh toán');
    } finally {
      setIsPaying(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 md:p-6 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[95vh] animate-scale-in border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hidden sm:flex items-center justify-center shadow-sm">
              <Handshake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-2xl text-slate-900 tracking-tight">{supplier.name}</h3>
              <p className="text-slate-500 font-medium text-sm mt-1 flex flex-wrap items-center gap-2">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-600">MST: {supplier.taxCode || '---'}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {supplier.phone || '---'}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors shrink-0">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 px-6 md:px-8 bg-slate-50/50 gap-2 pt-4">
          <button
            onClick={() => setActiveTab('INFO')}
            className={`px-5 py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all border-b-2 rounded-t-xl ${
              activeTab === 'INFO' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Info className="w-4 h-4" /> Thông tin & Công nợ
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-5 py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all border-b-2 rounded-t-xl ${
              activeTab === 'HISTORY' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Package className="w-4 h-4" /> Lịch sử Nhập kho
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          
          {/* TAB: THÔNG TIN & CÔNG NỢ */}
          {activeTab === 'INFO' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              
              {/* Cột trái: Thông tin NCC */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100/80 pb-4 mb-5 flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Building2 className="w-4 h-4" /></div>
                    Thông tin liên hệ
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Người đại diện</span>
                      <span className="font-bold text-slate-800">{supplier.contactPerson || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Số điện thoại</span>
                      <span className="font-mono font-bold text-slate-800">{supplier.phone || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</span>
                      <span className="font-medium text-slate-800 break-all">{supplier.email || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Địa chỉ</span>
                      <span className="font-medium text-slate-800 leading-relaxed">{supplier.address || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ghi chú nội bộ</span>
                      <span className="font-medium italic text-slate-600 leading-relaxed">{supplier.notes || 'Không có ghi chú'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100/80 pb-4 mb-5 flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Landmark className="w-4 h-4" /></div>
                    Tài khoản & Thanh toán
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kỳ hạn nợ</span>
                      <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-max">Net {supplier.paymentTerms}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ngân hàng</span>
                      <span className="font-bold text-slate-800">{supplier.bankName || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Số tài khoản</span>
                      <span className="font-mono font-bold text-emerald-600 tracking-tight text-base bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 w-max">{supplier.bankAccount || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột phải: Công nợ & Lịch sử nợ */}
              <div className="lg:col-span-8 flex flex-col gap-6 h-full">
                
                {/* Thẻ Tổng Nợ */}
                <div className="bg-rose-50 p-6 sm:p-8 rounded-3xl border border-rose-100 flex flex-col items-center justify-center shadow-sm shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
                  <p className="text-rose-800/80 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                    <CreditCard className="w-4 h-4"/> Cần thanh toán (Tổng nợ)
                  </p>
                  {loadingTotal ? <Spinner size="lg" className="text-rose-500 relative z-10" /> : (
                    <p className="text-4xl sm:text-5xl font-black text-rose-600 tracking-tight relative z-10 drop-shadow-sm">{formatCurrency(totalUnpaid)}</p>
                  )}
                </div>

                {/* BẢNG CHI TIẾT CÔNG NỢ */}
                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgb(0,0,0,0.02)] flex flex-col flex-1">
                  <div className="p-6 border-b border-slate-100/80 bg-white flex items-center gap-3 shrink-0">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-100"><FileText className="w-4 h-4" /></div>
                    <h3 className="font-bold text-lg text-slate-900 tracking-tight">Chi tiết các khoản nợ cần trả</h3>
                  </div>
                  
                  <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
                    <table className="w-full text-sm text-left min-w-[550px] text-slate-600">
                      <thead className="text-[11px] text-slate-500 uppercase font-bold bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100 tracking-wider">
                        <tr>
                          <th className="px-6 py-5">Mã Phiếu (PO)</th>
                          <th className="px-6 py-5 text-right">Tổng phát sinh</th>
                          <th className="px-6 py-5 text-right text-rose-600">Còn nợ lại</th>
                          <th className="px-6 py-5 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50/80">
                        {loadingDebts ? (
                          <tr><td colSpan={4} className="text-center py-20"><Spinner size="md" className="mx-auto text-indigo-600"/></td></tr>
                        ) : myDebts.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-slate-500 font-medium bg-slate-50/30">Nhà cung cấp này không có công nợ cần thanh toán.</td></tr>
                        ) : (
                          myDebts.map((d: any) => (
                            <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-mono text-[14px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase bg-indigo-50/50 px-2 py-1 rounded">
                                  {d.purchaseOrderCode || d.purchaseOrderId.slice(0,8)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-semibold text-slate-700 tracking-tight text-[15px]">
                                {formatCurrency(d.totalDebt)}
                              </td>
                              <td className="px-6 py-4 text-right font-black text-rose-600 tracking-tight text-base">
                                {formatCurrency(d.remainingAmount || (d.totalDebt - d.paidAmount))}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {d.remainingAmount > 0 ? (
                                  <button 
                                    onClick={() => {
                                      setSelectedDebt(d);
                                      setPayAmount(d.remainingAmount);
                                      setIsPayModalOpen(true);
                                    }}
                                    className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                                  >
                                    Thanh toán
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                                    <CheckCircle className="w-3 h-3"/> Đã trả hết
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LỊCH SỬ NHẬP KHO */}
          {activeTab === 'HISTORY' && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgb(0,0,0,0.02)] flex flex-col h-full">
              <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
                <table className="w-full text-sm text-left min-w-[700px] text-slate-600">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-5">Mã Phiếu (PO)</th>
                      <th className="px-6 py-5">Ngày tạo</th>
                      <th className="px-6 py-5 text-center">Trạng thái</th>
                      <th className="px-6 py-5 text-right">Tổng tiền</th>
                      <th className="px-6 py-5 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {loadingPo ? (
                      <tr><td colSpan={5} className="py-20 text-center"><Spinner size="lg" className="mx-auto text-indigo-600" /></td></tr>
                    ) : (poData?.content || []).length === 0 ? (
                      <tr><td colSpan={5} className="py-24 text-center text-slate-500 font-medium bg-slate-50/30">Chưa có lịch sử giao dịch / nhập kho.</td></tr>
                    ) : (
                      (poData?.content || []).map((po: any) => (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => { setSelectedPoId(po.id); setIsPoDetailsOpen(true); }}
                              className="font-mono font-bold text-[14px] text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              {po.code}
                            </button>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">
                            {formatDateTime(po.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                              po.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 
                              po.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'
                            }`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black tracking-tight text-base text-slate-900">
                            {formatCurrency(po.totalAmount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                                onClick={() => { setSelectedPoId(po.id); setIsPoDetailsOpen(true); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors mx-auto opacity-0 group-hover:opacity-100"
                                title="Xem chi tiết phiếu nhập"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {poData && poData.totalPages > 1 && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <Pagination page={poPage} totalPages={poData.totalPages} totalElements={poData.totalElements} size={5} onPageChange={setPoPage} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL THANH TOÁN CÔNG NỢ --- PORTAL RIÊNG BIỆT */}
      {isPayModalOpen && selectedDebt && createPortal(
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden border border-slate-100 flex flex-col">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Thanh toán nợ</h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                          PO: <strong className="text-indigo-600 font-mono">{selectedDebt.purchaseOrderCode || selectedDebt.purchaseOrderId.slice(0,8)}</strong>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsPayModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6 bg-slate-50/30">
                    <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex flex-col gap-1 shadow-sm">
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Dư nợ phiếu này</span>
                      <span className="font-black tracking-tight text-rose-600 text-2xl">{formatCurrency(selectedDebt.remainingAmount)}</span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số tiền thanh toán <span className="text-rose-500">*</span></label>
                        <input 
                            type="number" 
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            max={selectedDebt.remainingAmount}
                            className="w-full bg-white border border-slate-200 text-slate-900 text-xl font-black tracking-tight rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none shadow-sm"
                            placeholder="Nhập số tiền..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nguồn tiền <span className="text-rose-500">*</span></label>
                        <select 
                            value={fundType}
                            onChange={(e) => setFundType(e.target.value as 'CASH_111' | 'BANK_112')}
                            className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none cursor-pointer appearance-none shadow-sm"
                        >
                            <option value="CASH_111">Tiền mặt (TK 111)</option>
                            <option value="BANK_112">Chuyển khoản (TK 112)</option>
                        </select>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
                    <button 
                        onClick={() => setIsPayModalOpen(false)}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handlePayDebt}
                        disabled={isPaying || !payAmount || Number(payAmount) <= 0}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[0_4px_12px_rgb(99,102,241,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center min-w-[150px]"
                    >
                        {isPaying ? <Spinner size="sm" className="text-white" /> : 'Xác nhận thanh toán'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XEM CHI TIẾT PHIẾU NHẬP KHO --- */}
      {isPoDetailsOpen && selectedPoId && (
        <PurchaseOrderDetailsModal
          purchaseOrderId={selectedPoId}
          onClose={() => {
            setIsPoDetailsOpen(false);
            setSelectedPoId(null);
          }}
        />
      )}

    </div>
  );

  return createPortal(modalContent, document.body);
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 2: MODAL THÊM/SỬA 
// ─────────────────────────────────────────────────────────────────
function SupplierForm({ supplierId, onClose, onSaved }: { supplierId?: string; onClose: () => void; onSaved: () => void; }) {
  const isEdit = !!supplierId;
  
  const { data: freshSupplier, isLoading: loadingFresh } = useQuery({
    queryKey: ['supplier-detail', supplierId],
    queryFn: () => supplierService.getById(supplierId!).then(r => r.data.data),
    enabled: isEdit, 
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { paymentTerms: 30 },
  });

  useEffect(() => {
    if (freshSupplier) {
      reset({
        name: freshSupplier.name,
        taxCode: freshSupplier.taxCode || '',
        contactPerson: freshSupplier.contactPerson || '',
        phone: freshSupplier.phone || '',
        email: freshSupplier.email || '',
        address: freshSupplier.address || '',
        bankAccount: freshSupplier.bankAccount || '',
        bankName: freshSupplier.bankName || '',
        paymentTerms: freshSupplier.paymentTerms ?? 30,
        notes: freshSupplier.notes || '',
      });
    }
  }, [freshSupplier, reset]);

  const mut = useMutation({
    mutationFn: (data: SupplierFormValues) => isEdit ? supplierService.update(supplierId!, data) : supplierService.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Cập nhật thành công!' : 'Thêm nhà cung cấp thành công!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Có lỗi xảy ra khi lưu NCC'),
  });

  const onSubmit = (data: SupplierFormValues) => mut.mutate(data);

  const formModalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col animate-scale-in border border-slate-100 overflow-hidden">
        
        <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">{isEdit ? 'Cập nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Điền đầy đủ thông tin để quản lý đối tác dễ dàng hơn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        {isEdit && loadingFresh ? (
          <div className="flex-1 flex justify-center items-center py-20 bg-slate-50/30"><Spinner size="lg" className="text-indigo-600"/></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tên công ty / NCC <span className="text-rose-500">*</span></label>
                  <input {...register('name')} className={`w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm ${errors.name ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="Nhập tên đối tác..." autoFocus />
                  {errors.name && <span className="text-rose-500 text-xs font-bold mt-2 block">{errors.name.message}</span>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã số thuế</label>
                  <input {...register('taxCode')} className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-mono font-bold tracking-wider rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm" placeholder="Nhập MST..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Người liên hệ</label>
                  <input {...register('contactPerson')} className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm" placeholder="Đại diện liên hệ..." />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số điện thoại</label>
                  <input {...register('phone')} className={`w-full bg-white border border-slate-200 text-slate-900 text-sm font-mono font-bold tracking-wider rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm ${errors.phone ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="SĐT liên hệ..." />
                  {errors.phone && <span className="text-rose-500 text-xs font-bold mt-2 block">{errors.phone.message}</span>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                  <input {...register('email')} className={`w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="Địa chỉ email..." />
                  {errors.email && <span className="text-rose-500 text-xs font-bold mt-2 block">{errors.email.message}</span>}
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Địa chỉ</label>
                  <input {...register('address')} className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none shadow-sm" placeholder="Địa chỉ chi tiết..." />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100/60 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <div className="md:col-span-3">
                  <h4 className="font-bold text-emerald-800 text-sm flex items-center gap-2"><Landmark className="w-4 h-4"/> Thanh toán & Ngân hàng</h4>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Kỳ hạn nợ (Ngày) <span className="text-rose-500">*</span></label>
                  <input type="number" {...register('paymentTerms')} className={`w-full bg-white border border-emerald-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block p-3.5 transition-colors outline-none shadow-sm ${errors.paymentTerms ? 'border-rose-500' : ''}`} placeholder="30" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Ngân hàng thụ hưởng</label>
                  <input {...register('bankName')} className="w-full bg-white border border-emerald-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block p-3.5 transition-colors outline-none shadow-sm" placeholder="VD: VCB, MBBank..." />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Số tài khoản</label>
                  <input {...register('bankAccount')} className="w-full bg-white border border-emerald-200 text-slate-900 text-sm font-mono font-bold tracking-tight rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block p-3.5 transition-colors outline-none shadow-sm" placeholder="Số TK..." />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ghi chú nội bộ</label>
                <textarea {...register('notes')} className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 transition-colors outline-none resize-none shadow-sm custom-scrollbar" rows={3} placeholder="Ghi chú thêm về năng lực, lưu ý..." />
              </div>
              
            </div>
            <div className="px-8 py-5 border-t border-slate-100 flex gap-4 justify-end shrink-0 bg-white rounded-b-3xl">
              <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Hủy bỏ
              </button>
              <button type="submit" disabled={mut.isPending} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[0_4px_12px_rgb(99,102,241,0.3)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center min-w-[150px]">
                {mut.isPending ? <Spinner size="sm" className="text-white"/> : (isEdit ? 'Lưu thay đổi' : 'Thêm Nhà Cung Cấp')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(formModalContent, document.body);
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 3: PAGE CHÍNH 
// ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [viewing, setViewing] = useState<Supplier | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0); 
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: pagedData, isLoading, isRefetching } = useQuery({
    queryKey: ['suppliers', debouncedKeyword, page],
    queryFn: () => supplierService.getAll({ keyword: debouncedKeyword, page, size: PAGE_SIZE }).then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: (s: Supplier) => supplierService.update(s.id, { isActive: !s.isActive }),
    onSuccess: () => { 
      toast.success('Đã cập nhật trạng thái nhà cung cấp!'); 
      qc.invalidateQueries({ queryKey: ['suppliers'] }); 
    },
  });

  const [isExporting, setIsExporting] = useState(false);
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await supplierService.getAll({ size: 10000 });
      const allSuppliers = res.data.data.content;

      if (!allSuppliers || allSuppliers.length === 0) {
        toast.error('Không có dữ liệu để xuất');
        return;
      }
      const exportData = allSuppliers.map((s: any) => ({
        'Tên NCC': s.name,
        'Mã số thuế': s.taxCode || '',
        'Người liên hệ': s.contactPerson || '',
        'Số điện thoại': s.phone || '',
        'Email': s.email || '',
        'Địa chỉ': s.address || '',
        'Ngân hàng': s.bankName || '',
        'Số tài khoản': s.bankAccount || '',
        'Net Terms': s.paymentTerms,
        'Trạng thái': s.isActive ? 'Hoạt động' : 'Dừng',
        'Ghi chú': s.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "NhaCungCap");
      XLSX.writeFile(workbook, `DanhSach_NhaCungCap_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      toast.error('Lỗi khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsImporting(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        const bulkPayload = data.map((row: any) => ({
            name: String(row['Tên NCC'] || '').trim(),
            taxCode: row['Mã số thuế'] ? String(row['Mã số thuế']) : undefined,
            contactPerson: row['Người liên hệ'] ? String(row['Người liên hệ']) : undefined,
            phone: row['Số điện thoại'] ? String(row['Số điện thoại']) : undefined,
            email: row['Email'] ? String(row['Email']) : undefined,
            address: row['Địa chỉ'] ? String(row['Địa chỉ']) : undefined,
            bankName: row['Ngân hàng'] ? String(row['Ngân hàng']) : undefined,
            bankAccount: row['Số tài khoản'] ? String(row['Số tài khoản']) : undefined,
            paymentTerms: row['Net Terms'] ? Number(row['Net Terms']) : 30,
            notes: row['Ghi chú'] ? String(row['Ghi chú']) : undefined,
        })).filter(item => item.name !== '');

        if (bulkPayload.length === 0) {
            toast.error('File Excel rỗng hoặc thiếu cột Tên NCC.');
            return;
        }

        await supplierService.importBulk(bulkPayload);

        toast.success(`Đã import thành công.`);
        qc.invalidateQueries({ queryKey: ['suppliers'] });
      } catch (error) {
        toast.error('Lỗi khi import file Excel');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const suppliersList = pagedData?.content || [];

  // --- TÍNH TOÁN DATA CHO MINI DASHBOARD ---
  const dashboardStats = useMemo(() => {
    const termCount: Record<string, { count: number, color: string, label: string }> = {};
    let activeCount = 0;

    suppliersList.forEach((s: any, i: number) => {
      if (s.isActive) activeCount++;
      const termKey = `Net ${s.paymentTerms}`;
      if (!termCount[termKey]) {
        termCount[termKey] = { count: 0, color: CHART_COLORS[i % CHART_COLORS.length], label: termKey };
      }
      termCount[termKey].count++;
    });

    // Cập nhật lại màu sắc cho sinh động
    const chartData = Object.values(termCount).map((val, i) => ({
      name: val.label, value: val.count, color: CHART_COLORS[i % CHART_COLORS.length]
    })).sort((a,b) => b.value - a.value);

    return { activeCount, chartData };
  }, [suppliersList]);


  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Nhà cung cấp</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi thông tin, công nợ và lịch sử giao dịch với các đối tác.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm flex-1 md:flex-none disabled:opacity-50"
          >
            {isExporting ? <Spinner size="sm" className="text-slate-700" /> : <><Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất</span></>}
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm flex-1 md:flex-none disabled:opacity-50"
          >
            {isImporting ? <Spinner size="sm" className="text-slate-700" /> : <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Nhập</span></>}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />

          <button 
            onClick={() => { setEditingId(undefined); setShowForm(true); }} 
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all flex-1 md:flex-none"
          >
            <Plus className="w-5 h-5" /> Thêm NCC
          </button>
        </div>
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Card 1: Tổng quan */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Handshake className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Đối tác (trang này)</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{suppliersList.length} <span className="text-sm font-bold text-slate-400">/ {pagedData?.totalElements || 0}</span></h3>
            </div>
          </div>
          <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Đang hoạt động</span>
             <span className="font-black text-emerald-600 text-base">{dashboardStats.activeCount} NCC</span>
          </div>
        </div>

        {/* Card 2: Biểu đồ Cơ cấu Kỳ hạn nợ */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-8">
          <div className="w-1/3 h-[120px] relative shrink-0">
            {dashboardStats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardStats.chartData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardStats.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu kỳ hạn nợ (Trang này)</p>
            <div className="space-y-3">
              {dashboardStats.chartData.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{d.value} <span className="text-xs font-medium text-slate-400 ml-1">NCC</span></span>
                </div>
              ))}
              {dashboardStats.chartData.length > 3 && <p className="text-[11px] font-medium text-slate-400 italic">+ {dashboardStats.chartData.length - 3} kỳ hạn khác</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── DATA GRID & BỘ LỌC ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col relative min-h-[400px] animate-fade-in">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
              placeholder="Tìm tên, MST, SĐT, Email..."
              value={keyword} 
              onChange={e => setKeyword(e.target.value)} 
            />
          </div>
        </div>

        {/* Bảng Dữ Liệu */}
        {isRefetching && !isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
          <table className="w-full text-sm text-left min-w-[1000px] text-slate-600">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100 tracking-wider">
              <tr>
                <th className="px-6 py-5">Nhà cung cấp</th>
                <th className="px-6 py-5">Mã số thuế</th>
                <th className="px-6 py-5">Liên hệ</th>
                <th className="px-6 py-5">Tài khoản & Kỳ hạn</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right w-44">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {isLoading ? (
                <tr><td colSpan={6} className="py-24 text-center"><Spinner size="lg" className="mx-auto text-indigo-600" /></td></tr>
              ) : suppliersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <EmptyState 
                      icon={Handshake} 
                      title="Không tìm thấy nhà cung cấp nào" 
                      description="Hãy thử từ khóa tìm kiếm khác hoặc thêm nhà cung cấp mới." 
                    />
                  </td>
                </tr>
              ) : (
                suppliersList.map((s: any) => (
                  <tr key={s.id} className={`transition-colors group ${!s.isActive ? 'bg-slate-50/40 grayscale-[20%]' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-6 py-4">
                      <div className={`font-bold text-[14px] leading-snug ${!s.isActive ? 'text-slate-500' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>
                        {s.name}
                      </div>
                      {s.contactPerson && (
                        <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5 mt-1.5 uppercase tracking-wider">
                          <Building2 className="w-3.5 h-3.5" /> {s.contactPerson}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className={`font-mono font-bold tracking-tight text-[13px] ${!s.isActive ? 'text-slate-400' : 'text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 w-max'}`}>
                        {s.taxCode || '-'}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className={`flex flex-col gap-1.5 ${!s.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {s.phone && <div className="flex items-center gap-2 font-mono font-semibold text-[13px]"><Phone className="w-3.5 h-3.5 text-slate-400" /> {s.phone}</div>}
                        {s.email && <div className="flex items-center gap-2 text-xs font-medium truncate max-w-[200px]" title={s.email}><Mail className="w-3.5 h-3.5 text-slate-400" /> {s.email}</div>}
                        {!s.phone && !s.email && <span className="italic text-slate-400">Không có liên hệ</span>}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className={`flex flex-col gap-1.5 ${!s.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {s.bankAccount ? (
                          <div className="font-mono font-bold tracking-tight text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 w-max">{s.bankAccount}</div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {s.bankName ? <span className="text-slate-500 uppercase tracking-wider">{s.bankName}</span> : null}
                          {s.bankName && <span className="w-1 h-1 rounded-full bg-slate-300"></span>}
                          <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Net {s.paymentTerms}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${
                        s.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {s.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewing(s)} 
                          className="p-1.5 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors" 
                          title="Xem chi tiết & Công nợ"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setEditingId(s.id); setShowForm(true); }} 
                          className="p-1.5 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 transition-colors" 
                          title="Sửa thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleMut.mutate(s)} 
                          className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                            s.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`} 
                          title={s.isActive ? 'Khóa (Ngừng hoạt động)' : 'Mở khóa (Kích hoạt)'}
                        >
                          {s.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagedData && pagedData.totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 shrink-0">
            <Pagination 
              page={page} 
              totalPages={pagedData.totalPages} 
              totalElements={pagedData.totalElements} 
              size={PAGE_SIZE} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {showForm && <SupplierForm supplierId={editingId} onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['suppliers'] })} />}
      {viewing && <SupplierDetailsModal supplier={viewing} onClose={() => setViewing(undefined)} />}

      {/* CSS Animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}