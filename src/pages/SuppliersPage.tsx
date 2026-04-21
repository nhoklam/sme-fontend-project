import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Handshake, Search, Plus, X, Edit, Eye, EyeOff, Info, CreditCard, Download, Upload, Package, Clock, Building2, MapPin, Phone, Mail, Landmark, FileText } from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────────
// SCHEMA VALIDATION VỚI ZOD
// ─────────────────────────────────────────────────────────────────
const supplierSchema = z.object({
  name: z.string().min(1, 'Tên nhà cung cấp không được để trống'),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional().refine(val => !val || /^[0-9]{10,11}$/.test(val), {
    message: 'Số điện thoại phải từ 10-11 số hợp lệ',
  }),
  email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Định dạng email không hợp lệ',
  }),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  paymentTerms: z.coerce.number().min(0, 'Số ngày nợ phải lớn hơn hoặc bằng 0'),
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

  // --- STATE BƯỚC 3: QUẢN LÝ THANH TOÁN ---
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [fundType, setFundType] = useState<'CASH_111' | 'BANK_112'>('CASH_111');
  const [isPaying, setIsPaying] = useState(false);

  // --- STATE BƯỚC 4: QUẢN LÝ CHI TIẾT PHIẾU NHẬP ---
  const [isPoDetailsOpen, setIsPoDetailsOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Lấy Dư nợ Tổng cực nhanh từ Backend
  const { data: totalUnpaid = 0, isLoading: loadingTotal } = useQuery({
    queryKey: ['supplier-total-debt', supplier.id],
    queryFn: () => financeService.getTotalOutstandingBySupplier(supplier.id).then(r => r.data.data),
  });

  // Lấy Lịch sử nhập kho (Phân trang)
  const { data: poData, isLoading: loadingPo } = useQuery({
    queryKey: ['supplier-po-history', supplier.id, poPage],
    queryFn: () => purchaseService.getBySupplier(supplier.id, { page: poPage, size: 5 }).then(r => r.data.data),
    enabled: activeTab === 'HISTORY',
  });

  // Lấy các công nợ chưa trả để hiện chi tiết ở tab INFO
  const { data: debts, isLoading: loadingDebts } = useQuery({
    queryKey: ['supplier-unpaid-debts', supplier.id],
    queryFn: () => financeService.getOutstandingDebts().then((r: any) => r.data.data),
  });
  const myDebts = debts?.filter((d: any) => d.supplierId === supplier.id) || [];

  // --- HÀM BƯỚC 3: XỬ LÝ THANH TOÁN ---
  const handlePayDebt = async () => {
    if (!selectedDebt || !payAmount || Number(payAmount) <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (Number(payAmount) > selectedDebt.remainingAmount) {
      toast.error('Số tiền thanh toán không được lớn hơn số nợ còn lại');
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
      
      // Refresh dữ liệu nợ
      qc.invalidateQueries({ queryKey: ['supplier-unpaid-debts'] });
      qc.invalidateQueries({ queryKey: ['supplier-total-debt'] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi thanh toán');
    } finally {
      setIsPaying(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 transition-all">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] animate-slide-up border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center">
              <Handshake className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">{supplier.name}</h3>
              <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-3">
                <span>MST: <span className="font-mono text-slate-700">{supplier.taxCode || '---'}</span></span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>SĐT: <span className="font-mono text-slate-700">{supplier.phone || '---'}</span></span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100 shrink-0">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 px-6 bg-white gap-6">
          <button
            onClick={() => setActiveTab('INFO')}
            className={`py-3.5 font-bold text-sm flex items-center gap-2 transition-all relative ${
              activeTab === 'INFO' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Info className="w-4 h-4" /> Thông tin & Công nợ
            {activeTab === 'INFO' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-3.5 font-bold text-sm flex items-center gap-2 transition-all relative ${
              activeTab === 'HISTORY' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" /> Lịch sử Nhập kho
            {activeTab === 'HISTORY' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          
          {/* TAB: THÔNG TIN CƠ BẢN & BẢNG CÔNG NỢ */}
          {activeTab === 'INFO' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Cột trái: Thông tin NCC */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                  <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-500" /> Thông tin liên hệ
                  </h4>
                  <div className="space-y-3 text-[13px] sm:text-sm">
                    <div className="flex justify-between items-start border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Người đại diện:</span>
                      <span className="font-bold text-slate-800 text-right">{supplier.contactPerson || '-'}</span>
                    </div>
                    <div className="flex justify-between items-start border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Số điện thoại:</span>
                      <span className="font-mono font-bold text-slate-800 text-right tracking-tight">{supplier.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between items-start border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Email:</span>
                      <span className="font-medium text-slate-800 text-right">{supplier.email || '-'}</span>
                    </div>
                    <div className="flex justify-between items-start border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Kỳ hạn nợ:</span>
                      <span className="font-bold text-indigo-600 text-right">Net {supplier.paymentTerms}</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1 border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Địa chỉ:</span>
                      <span className="font-medium text-slate-800 leading-relaxed">{supplier.address || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-slate-500 font-medium">Ghi chú:</span>
                      <span className="font-medium italic text-slate-600 leading-relaxed">{supplier.notes || 'Không có ghi chú'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
                  <h4 className="font-bold text-slate-800 border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-500" /> Tài khoản Ngân hàng
                  </h4>
                  <div className="space-y-3 text-[13px] sm:text-sm">
                    <div className="flex justify-between items-start border-b border-slate-50 pb-2.5">
                      <span className="text-slate-500 font-medium">Ngân hàng:</span>
                      <span className="font-bold text-slate-800 text-right">{supplier.bankName || '-'}</span>
                    </div>
                    <div className="flex justify-between items-start pt-1">
                      <span className="text-slate-500 font-medium">Số tài khoản:</span>
                      <span className="font-mono font-bold text-emerald-600 tracking-tight text-right text-base">{supplier.bankAccount || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột phải: Công nợ & Lịch sử nợ */}
              <div className="lg:col-span-7 flex flex-col gap-6 h-full">
                
                {/* Thẻ Tổng Nợ */}
                <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex flex-col items-center justify-center shadow-sm shrink-0">
                  <p className="text-rose-800/80 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4"/> Cần thanh toán (Tổng nợ)
                  </p>
                  {loadingTotal ? <Spinner size="lg" className="text-rose-500" /> : (
                    <p className="text-4xl font-black text-rose-600 tracking-tight">{formatCurrency(totalUnpaid)}</p>
                  )}
                </div>

                {/* BẢNG CHI TIẾT CÔNG NỢ (BƯỚC 3) */}
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2.5 shrink-0">
                    <div className="p-1.5 bg-slate-200 text-slate-600 rounded-lg"><FileText className="w-4 h-4" /></div>
                    <h3 className="font-bold text-slate-900">Chi tiết các khoản nợ cần trả</h3>
                  </div>
                  
                  <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                    <table className="w-full text-sm text-left min-w-[500px]">
                      <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3">Mã Phiếu nhập</th>
                          <th className="px-4 py-3 text-right">Tổng phát sinh</th>
                          <th className="px-4 py-3 text-right text-rose-600">Còn nợ lại</th>
                          <th className="px-4 py-3 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {loadingDebts ? (
                          <tr><td colSpan={4} className="text-center py-10"><Spinner size="md" className="mx-auto text-indigo-600"/></td></tr>
                        ) : myDebts.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-12 text-slate-500 font-medium">Nhà cung cấp này không có công nợ.</td></tr>
                        ) : (
                          myDebts.map((d: any) => (
                            <tr key={d.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-4 py-4 font-mono text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase">
                                {d.purchaseOrderCode || d.purchaseOrderId.slice(0,8)}
                              </td>
                              <td className="px-4 py-4 text-right font-semibold text-slate-700 tracking-tight text-[14px]">
                                {formatCurrency(d.totalDebt)}
                              </td>
                              <td className="px-4 py-4 text-right font-black text-rose-600 tracking-tight text-[15px]">
                                {formatCurrency(d.remainingAmount || (d.totalDebt - d.paidAmount))}
                              </td>
                              <td className="px-4 py-4 text-center">
                                {d.remainingAmount > 0 ? (
                                  <button 
                                    onClick={() => {
                                      setSelectedDebt(d);
                                      setPayAmount(d.remainingAmount);
                                      setIsPayModalOpen(true);
                                    }}
                                    className="bg-white border border-indigo-200 text-indigo-700 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm"
                                  >
                                    Thanh toán
                                  </button>
                                ) : (
                                  <span className="inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">Đã trả hết</span>
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

          {/* TAB: LỊCH SỬ NHẬP KHO (CẬP NHẬT BƯỚC 4) */}
          {activeTab === 'HISTORY' && (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
              <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
                <table className="w-full text-sm text-left min-w-[700px]">
                  <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4">Mã Phiếu (PO)</th>
                      <th className="px-5 py-4">Ngày tạo</th>
                      <th className="px-5 py-4 text-center">Trạng thái</th>
                      <th className="px-5 py-4 text-right">Tổng tiền</th>
                      <th className="px-5 py-4 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingPo ? (
                      <tr><td colSpan={5} className="py-16 text-center"><Spinner size="lg" className="mx-auto text-indigo-600" /></td></tr>
                    ) : (poData?.content || []).length === 0 ? (
                      <tr><td colSpan={5} className="py-16 text-center text-slate-500 font-medium">Chưa có lịch sử giao dịch / nhập kho.</td></tr>
                    ) : (
                      (poData?.content || []).map((po: any) => (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-5 py-4">
                            <button 
                              onClick={() => { setSelectedPoId(po.id); setIsPoDetailsOpen(true); }}
                              className="font-mono font-bold text-[13px] text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              {po.code}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-slate-500 font-medium text-[13px] flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3.5 h-3.5"/> {formatDateTime(po.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                              po.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              po.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-black tracking-tight text-[15px] text-slate-800">
                            {formatCurrency(po.totalAmount)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                                onClick={() => { setSelectedPoId(po.id); setIsPoDetailsOpen(true); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors mx-auto opacity-80 group-hover:opacity-100"
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

      {/* --- MODAL THANH TOÁN CÔNG NỢ (BƯỚC 3) --- TÁCH PORTAL RIÊNG BIỆT ĐỂ KHÔNG BỊ CHÌM */}
      {isPayModalOpen && selectedDebt && createPortal(
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-all">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden border border-slate-100">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Thanh toán công nợ</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Mã Phiếu: <strong className="text-indigo-600 font-mono">{selectedDebt.purchaseOrderCode || selectedDebt.purchaseOrderId.slice(0,8)}</strong>
                    </p>
                  </div>
                </div>
                
                <div className="p-6 space-y-5">
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex justify-between items-center shadow-sm">
                      <span className="text-sm font-bold text-rose-800">Dư nợ phiếu này:</span>
                      <span className="font-black tracking-tight text-rose-600 text-xl">{formatCurrency(selectedDebt.remainingAmount)}</span>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Số tiền thanh toán (VNĐ) <span className="text-rose-500">*</span></label>
                        <input 
                            type="number" 
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            max={selectedDebt.remainingAmount}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-lg font-black tracking-tight rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none"
                            placeholder="Nhập số tiền..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Nguồn tiền thanh toán <span className="text-rose-500">*</span></label>
                        <select 
                            value={fundType}
                            onChange={(e) => setFundType(e.target.value as 'CASH_111' | 'BANK_112')}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3.5 transition-colors outline-none cursor-pointer appearance-none"
                        >
                            <option value="CASH_111">Tiền mặt (Quỹ TK 111)</option>
                            <option value="BANK_112">Chuyển khoản (Quỹ TK 112)</option>
                        </select>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={() => setIsPayModalOpen(false)}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handlePayDebt}
                        disabled={isPaying || !payAmount || Number(payAmount) <= 0}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[140px]"
                    >
                        {isPaying ? <Spinner size="sm" className="text-white" /> : 'Xác nhận thanh toán'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* --- MODAL XEM CHI TIẾT PHIẾU NHẬP KHO (BƯỚC 4) --- */}
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
      toast.success(isEdit ? 'Cập nhật thông tin thành công!' : 'Thêm nhà cung cấp thành công!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Có lỗi xảy ra khi lưu NCC'),
  });

  const onSubmit = (data: SupplierFormValues) => mut.mutate(data);

  const formModalContent = (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col animate-slide-up border border-slate-100 overflow-hidden">
        
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center">
              <Handshake className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">{isEdit ? 'Cập nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        {isEdit && loadingFresh ? (
          <div className="flex-1 flex justify-center items-center p-12"><Spinner size="lg" className="text-indigo-600"/></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên công ty / NCC <span className="text-rose-500">*</span></label>
                  <input {...register('name')} className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium ${errors.name ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="Nhập tên..." autoFocus />
                  {errors.name && <span className="text-rose-500 text-xs font-bold mt-1.5 block">{errors.name.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã số doanh nghiệp (MST)</label>
                  <input {...register('taxCode')} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-mono font-medium" placeholder="Nhập mã số thuế..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Người liên hệ</label>
                  <input {...register('contactPerson')} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" placeholder="Tên người đại diện..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Số điện thoại</label>
                  <input {...register('phone')} className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-mono font-medium ${errors.phone ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="Số điện thoại..." />
                  {errors.phone && <span className="text-rose-500 text-xs font-bold mt-1.5 block">{errors.phone.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email liên hệ</label>
                  <input {...register('email')} className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium ${errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="Địa chỉ email..." />
                  {errors.email && <span className="text-rose-500 text-xs font-bold mt-1.5 block">{errors.email.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Kỳ hạn nợ Net (Ngày) <span className="text-rose-500">*</span></label>
                  <input type="number" {...register('paymentTerms')} className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium ${errors.paymentTerms ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="VD: 30" />
                  {errors.paymentTerms && <span className="text-rose-500 text-xs font-bold mt-1.5 block">{errors.paymentTerms.message}</span>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Địa chỉ</label>
                <input {...register('address')} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" placeholder="Nhập địa chỉ chi tiết..." />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="md:col-span-2">
                  <h4 className="font-bold text-emerald-800 text-sm flex items-center gap-1.5"><Landmark className="w-4 h-4"/> Thông tin thanh toán</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1.5">Ngân hàng thụ hưởng</label>
                  <input {...register('bankName')} className="w-full bg-white border border-emerald-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block p-3 transition-colors outline-none font-medium shadow-sm" placeholder="VD: Vietcombank, MBBank..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1.5">Số tài khoản</label>
                  <input {...register('bankAccount')} className="w-full bg-white border border-emerald-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block p-3 transition-colors outline-none font-mono font-bold tracking-tight shadow-sm" placeholder="Nhập số tài khoản..." />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Ghi chú nội bộ</label>
                <textarea {...register('notes')} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium resize-none" rows={3} placeholder="Ghi chú thêm về nhà cung cấp này..." />
              </div>
              
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                Hủy bỏ
              </button>
              <button type="submit" disabled={mut.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[140px]">
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
      const exportData = allSuppliers.map(s => ({
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

  // --- HÀM BƯỚC 2: TỐI ƯU IMPORT EXCEL BẰNG BULK API ---
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

        // Map toàn bộ data excel thành array payload
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
        })).filter(item => item.name !== ''); // Bỏ qua các dòng không có tên

        if (bulkPayload.length === 0) {
            toast.error('File Excel rỗng hoặc không đúng định dạng cột (Tên NCC).');
            return;
        }

        // Gọi 1 API duy nhất để lưu toàn bộ
        await supplierService.importBulk(bulkPayload);

        toast.success(`Đã import thành công danh sách nhà cung cấp.`);
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

  if (isLoading && page === 0) return <PageLoader />;

  const suppliersList = pagedData?.content || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Handshake className="w-6 h-6 text-indigo-600" /> Quản lý Nhà cung cấp
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi, cập nhật thông tin và quản lý công nợ Nhà cung cấp</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors text-sm font-bold text-emerald-700 bg-white border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 shadow-sm flex-1 sm:flex-none disabled:opacity-50"
            title="Xuất danh sách ra file Excel"
          >
            {isExporting ? <Spinner size="sm" className="text-emerald-700" /> : <><Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất</span> Excel</>}
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors text-sm font-bold text-blue-700 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 shadow-sm flex-1 sm:flex-none disabled:opacity-50"
            title="Nhập danh sách từ file Excel"
          >
            {isImporting ? <Spinner size="sm" className="text-blue-700" /> : <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Nhập</span> Excel</>}
          </button>
          <input 
            type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" 
          />

          <button 
            onClick={() => { setEditingId(undefined); setShowForm(true); }} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 text-sm"
          >
            <Plus className="w-5 h-5 mr-1" /> Thêm NCC
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
          <input 
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium" 
            placeholder="Tìm theo Tên, Mã số thuế, SĐT, Email..."
            value={keyword} 
            onChange={e => setKeyword(e.target.value)} 
          />
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative min-h-[400px]">
        {isRefetching && !isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4">Mã số thuế</th>
                <th className="px-5 py-4">Thông tin liên hệ</th>
                <th className="px-5 py-4">Tài khoản Ngân hàng</th>
                <th className="px-5 py-4 text-center">Net Terms</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[13px] sm:text-sm">
              {suppliersList.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <EmptyState 
                      icon={Handshake} 
                      title="Không tìm thấy nhà cung cấp nào phù hợp" 
                      description="Hãy thử từ khóa tìm kiếm khác hoặc thêm nhà cung cấp mới" 
                    />
                  </td>
                </tr>
              ) : (
                suppliersList.map(s => (
                  <tr key={s.id} className={`transition-colors group ${!s.isActive ? 'bg-slate-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-5 py-4">
                      <div className={`font-bold text-[14px] leading-snug ${!s.isActive ? 'text-slate-500' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>
                        {s.name}
                      </div>
                      {s.contactPerson && (
                        <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1 mt-1.5">
                          <Building2 className="w-3 h-3" /> Đại diện: {s.contactPerson}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className={`font-mono font-bold tracking-tight text-[13px] ${!s.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {s.taxCode ?? '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`flex flex-col gap-1 ${!s.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {s.phone && <div className="flex items-center gap-1.5 font-mono font-bold tracking-tight"><Phone className="w-3.5 h-3.5" /> {s.phone}</div>}
                        {s.email && <div className="flex items-center gap-1.5 text-xs font-medium truncate max-w-[180px]" title={s.email}><Mail className="w-3.5 h-3.5" /> {s.email}</div>}
                        {!s.phone && !s.email && '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`flex flex-col gap-1 ${!s.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {s.bankAccount && <div className="font-mono font-bold tracking-tight text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block self-start">{s.bankAccount}</div>}
                        {s.bankName && <div className="text-xs font-medium mt-0.5"><span className="text-slate-400">NH:</span> {s.bankName}</div>}
                        {!s.bankAccount && !s.bankName && '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-sm">
                        Net {s.paymentTerms}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                        s.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {s.isActive ? 'Hoạt động' : 'Dừng'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-90 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewing(s)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors" 
                          title="Xem chi tiết & Lịch sử Nhập hàng"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setEditingId(s.id); setShowForm(true); }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 transition-colors" 
                          title="Sửa thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleMut.mutate(s)} 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            s.isActive 
                              ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700' 
                              : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700'
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
        
        {/* ── PAGINATION ── */}
        {pagedData && pagedData.totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
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
    </div>
  );
}