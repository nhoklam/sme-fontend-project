import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Power, Trophy, Filter, Clock } from 'lucide-react';
import { customerService } from '@/services/customer.service';
import type { Customer } from '@/types';
import { CustomerModal } from '@/pages/CustomerModal';
import { CustomerHistoryModal } from '@/pages/CustomerHistoryModal';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  // States cho Lọc và Tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>(''); // Rỗng là lấy tất cả
  const [isTopSpenders, setIsTopSpenders] = useState(false);

  // States cho Phân trang
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const size = 10;

  // States cho Modal Thêm/Sửa (ĐÃ SỬA: Quản lý bằng ID thay vì nguyên Object)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // States cho Modal Lịch sử giao dịch
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  // Gọi API lấy dữ liệu
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let response;
      if (isTopSpenders) {
        response = await customerService.getTopSpenders({ page, size });
      } else {
        response = await customerService.getAll({ 
          keyword: searchTerm, 
          tier: tierFilter || undefined, 
          page, 
          size 
        });
      }
      
      setCustomers(response.data.data.content);
      setTotalPages(response.data.data.totalPages);
    } catch (error) {
      console.error('Lỗi khi tải danh sách khách hàng:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải lại dữ liệu khi các dependency thay đổi
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, tierFilter, page, isTopSpenders]);

  // Xử lý Mở Modal
  const handleOpenModal = (customer?: Customer) => {
    setEditingCustomerId(customer?.id || null);
    setIsModalOpen(true);
  };

  // Xử lý Lưu (Thêm mới hoặc Cập nhật)
  const handleSaveCustomer = async (data: Partial<Customer>) => {
    if (editingCustomerId) {
      await customerService.update(editingCustomerId, data);
      toast.success('Cập nhật khách hàng thành công!');
    } else {
      await customerService.create(data);
      toast.success('Thêm khách hàng thành công!');
    }
    fetchCustomers(); // Tải lại danh sách sau khi lưu
  };

  // Xử lý Khóa/Mở khóa (Toggle Active)
  const handleToggleActive = async (customer: Customer) => {
    if (window.confirm(`Bạn có chắc muốn ${customer.isActive ? 'khóa' : 'mở khóa'} khách hàng này?`)) {
      try {
        await customerService.update(customer.id, { isActive: !customer.isActive });
        toast.success(`Đã ${customer.isActive ? 'khóa' : 'mở khóa'} khách hàng!`);
        fetchCustomers();
      } catch (error) {
        console.error('Lỗi khi thay đổi trạng thái:', error);
        toast.error('Lỗi cập nhật trạng thái');
      }
    }
  };

  // Helper render màu cho Hạng thẻ
  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case 'GOLD': return <span className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-bold border border-yellow-200">Vàng</span>;
      case 'SILVER': return <span className="px-3 py-1 text-xs rounded-full bg-slate-200 text-slate-800 font-bold border border-slate-300">Bạc</span>;
      default: return <span className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">Tiêu chuẩn</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Khách hàng</h1>
          <p className="text-sm text-gray-500 mt-1">Xem, thêm mới, cập nhật và quản lý hạng thẻ khách hàng</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setIsTopSpenders(!isTopSpenders);
              setPage(0); // Reset về trang 1
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border rounded-lg transition-colors font-medium ${
              isTopSpenders 
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700 shadow-sm' 
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Trophy className="w-4 h-4" />
            {isTopSpenders ? 'Đang xem Top Chi tiêu' : 'Top Chi tiêu'}
          </button>
          
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 btn-primary py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Thêm khách hàng
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT hoặc Email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="input pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-64 relative shrink-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(0);
            }}
            className="input pl-9 w-full bg-white disabled:bg-gray-100 disabled:text-gray-400"
            disabled={isTopSpenders} // Không cho lọc hạng khi xem top
            title={isTopSpenders ? "Tắt chế độ Top Chi Tiêu để dùng bộ lọc này" : ""}
          >
            <option value="">Tất cả hạng thẻ</option>
            <option value="STANDARD">Hạng Tiêu chuẩn</option>
            <option value="SILVER">Hạng Bạc</option>
            <option value="GOLD">Hạng Vàng</option>
          </select>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Liên hệ</th>
                <th>Hạng thẻ</th>
                <th className="text-right">Tổng chi tiêu</th>
                <th className="text-center">Trạng thái</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    <div className="flex justify-center"><Spinner size="md" /></div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-500">
                    Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className={`hover:bg-gray-50 ${!customer.isActive ? 'opacity-60 bg-gray-50/50' : ''}`}>
                    <td>
                      <div className="font-bold text-gray-900">{customer.fullName}</div>
                      <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]" title={customer.notes}>
                        {customer.notes || 'Không có ghi chú'}
                      </div>
                    </td>
                    <td>
                      <div className="font-mono text-gray-700">{customer.phoneNumber}</div>
                      {customer.email && <div className="text-gray-500 text-xs">{customer.email}</div>}
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        {renderTierBadge(customer.customerTier)}
                        <span className="text-xs text-gray-400">{customer.loyaltyPoints} điểm</span>
                      </div>
                    </td>
                    <td className="text-right font-bold text-primary-600">
                      {customer.totalSpent?.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="text-center">
                      <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                        customer.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {customer.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        {/* NÚT XEM LỊCH SỬ GIAO DỊCH */}
                        <button
                          onClick={() => {
                            setHistoryCustomer(customer);
                            setIsHistoryOpen(true);
                          }}
                          className="btn-ghost btn-sm p-1.5 text-indigo-600 hover:bg-indigo-50"
                          title="Xem lịch sử giao dịch"
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenModal(customer)}
                          className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50"
                          title="Xem chi tiết / Cập nhật"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(customer)}
                          className={`btn-ghost btn-sm p-1.5 ${
                            customer.isActive 
                              ? 'text-red-500 hover:bg-red-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={customer.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between bg-gray-50/50 rounded-b-xl">
            <span className="text-sm text-gray-500 font-medium">
              Trang {page + 1} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary btn-sm px-4"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary btn-sm px-4"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL THÊM/SỬA */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
        customerId={editingCustomerId}
      />

      {/* MODAL XEM LỊCH SỬ */}
      <CustomerHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        customer={historyCustomer}
      />
    </div>
  );
}