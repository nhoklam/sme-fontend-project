import React, { useState, useEffect } from 'react';
import { X, Store, Globe, Clock, CheckCircle, Receipt, ShoppingBag } from 'lucide-react';
import { customerService } from '@/services/customer.service';
import type { Customer } from '@/types';
import { Pagination, Spinner } from '@/components/ui';

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [history, setHistory] = useState<{ invoices: any[]; orders: any[] }>({ invoices: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'POS' | 'ONLINE'>('POS');

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6; // Tăng lên 6 dòng cho cân đối layout mới

  useEffect(() => {
    if (isOpen && customer) {
      fetchHistory();
      setPage(0);
    }
  }, [isOpen, customer]);

  useEffect(() => {
    setPage(0);
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await customerService.getHistory(customer!.id);
      setHistory(res.data.data);
    } catch (error) {
      console.error('Lỗi khi tải lịch sử:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  const currentList = activeTab === 'POS' ? history.invoices : history.orders;
  const totalElements = currentList.length;
  const totalPages = Math.ceil(totalElements / PAGE_SIZE);
  const paginatedList = currentList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in border border-slate-100">
        
        {/* ── HEADER ── */}
        <div className="px-6 md:px-8 py-5 md:py-6 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hidden sm:flex items-center justify-center shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                Lịch sử giao dịch: <span className="text-indigo-600">{customer.fullName}</span>
              </h2>
              <div className="flex items-center gap-3 mt-1.5 text-sm font-medium text-slate-500">
                <span>SĐT: <strong className="text-slate-700">{customer.phoneNumber}</strong></span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>Tổng chi tiêu: <strong className="text-indigo-600">{customer.totalSpent?.toLocaleString('vi-VN')} đ</strong></span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="flex px-6 md:px-8 pt-4 bg-slate-50/50 border-b border-slate-100 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-5 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all border-b-2 rounded-t-xl ${
              activeTab === 'POS' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Store className="w-4 h-4" /> Tại quầy (POS) 
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'POS' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{history.invoices.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('ONLINE')}
            className={`px-5 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all border-b-2 rounded-t-xl ${
              activeTab === 'ONLINE' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Globe className="w-4 h-4" /> Đặt Online
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeTab === 'ONLINE' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{history.orders.length}</span>
          </button>
        </div>

        {/* ── NỘI DUNG BẢNG ── */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Spinner size="lg" className="text-indigo-600 mb-4" />
              <p className="font-medium animate-pulse">Đang truy xuất lịch sử giao dịch...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-5">Mã giao dịch</th>
                    <th className="px-6 py-5">Thời gian</th>
                    <th className="px-6 py-5 text-center">Trạng thái</th>
                    <th className="px-6 py-5 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/80">
                  {paginatedList.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-400">
                            {activeTab === 'POS' ? <Receipt className="w-4 h-4"/> : <ShoppingBag className="w-4 h-4"/>}
                          </div>
                          <span className="font-bold text-indigo-600 text-[14px]">{item.code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {new Date(item.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.status ? (
                          <span className="inline-flex px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            {item.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            <CheckCircle className="w-3 h-3" /> Hoàn tất
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[15px] text-slate-900 tracking-tight">
                        {item.finalAmount?.toLocaleString('vi-VN')} <span className="text-xs text-slate-500 font-bold">đ</span>
                      </td>
                    </tr>
                  ))}
                  {currentList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            {activeTab === 'POS' ? <Receipt className="w-8 h-8 text-slate-300"/> : <ShoppingBag className="w-8 h-8 text-slate-300"/>}
                          </div>
                          <h3 className="font-bold text-slate-700 text-base">Chưa có giao dịch</h3>
                          <p className="text-slate-500 text-sm mt-1">Khách hàng chưa phát sinh giao dịch nào ở mục này.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PAGINATION & FOOTER ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-3xl shrink-0 flex items-center justify-between">
          <div className="flex-1">
            {totalPages > 1 && (
              <Pagination 
                page={page} 
                totalPages={totalPages} 
                totalElements={totalElements} 
                size={PAGE_SIZE} 
                onPageChange={setPage} 
              />
            )}
          </div>
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm ml-4"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};