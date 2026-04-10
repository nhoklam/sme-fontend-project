import React, { useState, useEffect } from 'react';
import { X, Store, Globe, Clock } from 'lucide-react';
import { customerService } from '@/services/customer.service';
import type { Customer } from '@/types';

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

  useEffect(() => {
    if (isOpen && customer) {
      fetchHistory();
    }
  }, [isOpen, customer]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-blue-600 p-5 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5" /> Lịch sử giao dịch: {customer.fullName}
            </h2>
            <p className="text-blue-100 text-sm mt-1">SĐT: {customer.phoneNumber} | Tổng chi tiêu: {customer.totalSpent?.toLocaleString('vi-VN')} đ</p>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setActiveTab('POS')}
            className={`flex-1 py-3 font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'POS' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Store className="w-4 h-4" /> Tại quầy (POS) - {history.invoices.length} đơn
          </button>
          <button
            onClick={() => setActiveTab('ONLINE')}
            className={`flex-1 py-3 font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'ONLINE' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Globe className="w-4 h-4" /> Đặt Online - {history.orders.length} đơn
          </button>
        </div>

        {/* Nội dung danh sách */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
          {loading ? (
            <div className="py-10 text-center text-gray-500 animate-pulse">Đang tải dữ liệu lịch sử...</div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="p-3">Mã đơn</th>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(activeTab === 'POS' ? history.invoices : history.orders).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-blue-600">{item.code}</td>
                      <td className="p-3 text-gray-600">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="p-3">
                        {item.status ? (
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                            {item.status}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 rounded-full text-xs font-medium text-green-700">
                            Hoàn tất
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900">
                        {item.finalAmount?.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))}
                  {(activeTab === 'POS' ? history.invoices : history.orders).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Khách hàng chưa có giao dịch nào ở mục này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};