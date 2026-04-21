import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Power, Trophy, Filter, Clock, Download, Upload, Users } from 'lucide-react';
import { customerService } from '@/services/customer.service';
import type { Customer } from '@/types';
import { CustomerModal } from '@/pages/CustomerModal';
import { CustomerHistoryModal } from '@/pages/CustomerHistoryModal';
import toast from 'react-hot-toast';
import { Spinner, Pagination, EmptyState } from '@/components/ui'; 
import * as XLSX from 'xlsx'; 

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>(''); 
  const [isTopSpenders, setIsTopSpenders] = useState(false);

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0); 
  const size = 15; // Tăng size lên 15 cho phù hợp giao diện mới

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  // === STATE PHỤC VỤ IMPORT EXCEL ===
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomers = async () => {
    if (customers.length === 0) setLoading(true);
    else setIsRefetching(true);
    
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
      setTotalElements(response.data.data.totalElements); 
    } catch (error) {
      console.error('Lỗi khi tải danh sách khách hàng:', error);
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, tierFilter, page, isTopSpenders]);

  const handleOpenModal = (customer?: Customer) => {
    setEditingCustomerId(customer?.id || null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (data: Partial<Customer>) => {
    if (editingCustomerId) {
      await customerService.update(editingCustomerId, data);
      toast.success('Cập nhật khách hàng thành công!');
    } else {
      await customerService.create(data);
      toast.success('Thêm khách hàng thành công!');
    }
    fetchCustomers(); 
  };

  const handleToggleActive = async (customer: Customer) => {
    if (window.confirm(`Bạn có chắc muốn ${customer.isActive ? 'khóa' : 'mở khóa'} khách hàng này?`)) {
      try {
        await customerService.update(customer.id, { isActive: !customer.isActive });
        toast.success(`Đã ${customer.isActive ? 'khóa' : 'mở khóa'} khách hàng!`);
        fetchCustomers();
      } catch (error) {
        toast.error('Lỗi cập nhật trạng thái');
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading('Đang chuẩn bị dữ liệu xuất...', { id: 'export-excel' });
      const response = await customerService.getAll({ size: 10000, keyword: searchTerm });
      const dataToExport = response.data.data.content || [];

      if (!dataToExport || dataToExport.length === 0) {
        toast.error('Không có dữ liệu để xuất', { id: 'export-excel' });
        return;
      }

      const excelData = dataToExport.map((cust: any, index: number) => ({
        'STT': index + 1,
        'Tên Khách Hàng': cust.fullName,
        'Số Điện Thoại': cust.phoneNumber,
        'Email': cust.email || '',
        'Ngày Sinh': cust.dateOfBirth ? cust.dateOfBirth.substring(0, 10) : '',
        'Hạng Thẻ': cust.customerTier,
        'Tổng Chi Tiêu': cust.totalSpent || 0,
        'Điểm Tích Lũy': cust.loyaltyPoints || 0,
        'Địa Chỉ': cust.address || '',
        'Trạng thái': cust.isActive ? 'Hoạt động' : 'Đã khóa'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "KhachHang");
      XLSX.writeFile(workbook, `Danh_Sach_Khach_Hang_${new Date().getTime()}.xlsx`);
      
      toast.success('Xuất file thành công!', { id: 'export-excel' });
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xuất file', { id: 'export-excel' });
    }
  };

  // === HÀM XỬ LÝ IMPORT EXCEL ===
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading('Đang phân tích file Excel...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        // Map các cột Excel sang Object Payload cho API
        const bulkPayload = data.map((row: any) => ({
          fullName: String(row['Tên Khách Hàng'] || '').trim(),
          phoneNumber: row['Số Điện Thoại'] ? String(row['Số Điện Thoại']).trim() : undefined,
          email: row['Email'] ? String(row['Email']).trim() : undefined,
          address: row['Địa Chỉ'] ? String(row['Địa Chỉ']).trim() : undefined,
          gender: row['Giới Tính'] === 'Nam' ? 'MALE' : (row['Giới Tính'] === 'Nữ' ? 'FEMALE' : 'OTHER'),
          notes: row['Ghi chú'] ? String(row['Ghi chú']).trim() : undefined,
        })).filter(item => item.fullName !== '' && item.phoneNumber); // Lọc bỏ dòng thiếu Tên hoặc SĐT

        if (bulkPayload.length === 0) {
          toast.error('File Excel rỗng hoặc không đúng định dạng cột (Tên Khách Hàng, Số Điện Thoại).', { id: toastId });
          return;
        }

        await customerService.importBulk(bulkPayload);
        toast.success(`Đã import thành công danh sách khách hàng mới.`, { id: toastId });
        fetchCustomers(); // Tải lại danh sách Data Table
      } catch (error) {
        console.error("Lỗi Import:", error);
        toast.error('Lỗi định dạng. Hãy tải file xuất mẫu để xem các cột chuẩn.', { id: toastId });
      } finally {
        setIsImporting(false);
        // Reset file input để có thể chọn lại cùng 1 file nếu cần
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.readAsBinaryString(file);
  };

  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case 'GOLD': 
        return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg bg-amber-100 text-amber-700 font-bold border border-amber-200 shadow-sm">Hạng Vàng</span>;
      case 'SILVER': 
        return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200 shadow-sm">Hạng Bạc</span>;
      default: 
        return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100 shadow-sm">Tiêu chuẩn</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> Quản lý Khách hàng
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Xem, thêm mới, cập nhật và quản lý phân hạng thẻ thành viên</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors text-sm font-bold text-emerald-700 bg-white border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 shadow-sm flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất</span> Excel
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors text-sm font-bold text-blue-700 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 shadow-sm flex-1 sm:flex-none disabled:opacity-50"
          >
            {isImporting ? <Spinner size="sm" className="text-blue-700" /> : <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Nhập</span> Excel</>}
          </button>
          
          {/* Input file ẩn */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          
          <button 
            onClick={() => handleOpenModal()} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 text-sm"
          >
            <Plus className="w-5 h-5 mr-1" /> Thêm Khách hàng
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-stretch md:items-center gap-4 transition-colors ${isTopSpenders ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100'}`}>
        
        {/* Nhóm Search */}
        <div className="flex flex-col gap-1 w-full md:flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
          <input
            type="text"
            placeholder="Tìm theo Tên, Số điện thoại hoặc Email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            disabled={isTopSpenders}
            className={`w-full border text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium ${
              isTopSpenders 
                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-slate-50 border-slate-200 text-slate-900"
            }`}
          />
        </div>

        <div className="flex gap-3 flex-col sm:flex-row">
          {/* Lọc hạng thẻ */}
          <div className="relative flex-1 sm:w-56 shrink-0">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setPage(0); }}
              disabled={isTopSpenders} 
              className={`w-full border text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none ${
                isTopSpenders 
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <option value="">Tất cả hạng thẻ</option>
              <option value="STANDARD">Hạng Tiêu chuẩn</option>
              <option value="SILVER">Hạng Bạc</option>
              <option value="GOLD">Hạng Vàng</option>
            </select>
          </div>

          {/* Toggle Top Spenders */}
          <button
            onClick={() => { setIsTopSpenders(!isTopSpenders); setPage(0); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border rounded-xl transition-all text-sm font-bold shadow-sm ${
              isTopSpenders 
                ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-amber-200/50' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <Trophy className={`w-4 h-4 ${isTopSpenders ? 'text-amber-600' : 'text-slate-400'}`} />
            {isTopSpenders ? 'Đang xem Top Chi Tiêu' : 'Lọc Top Chi Tiêu'}
          </button>
        </div>
        
        {/* Ghi chú khi đang bật Top Spenders trên Mobile */}
        {isTopSpenders && (
          <span className="text-[11px] font-bold text-amber-600 block md:hidden w-full mt-[-8px]">
            * Tìm kiếm & Lọc bị vô hiệu hóa khi xem Top Chi Tiêu.
          </span>
        )}
      </div>

      {/* ── BẢNG DỮ LIỆU ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative min-h-[400px]">
        {isRefetching && !loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar p-2 flex-1">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Khách hàng</th>
                <th className="px-5 py-4">Liên hệ</th>
                <th className="px-5 py-4">Hạng thẻ</th>
                <th className="px-5 py-4 text-right">Tổng chi tiêu</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Spinner size="lg" className="mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <EmptyState 
                      icon={Users} 
                      title="Không tìm thấy khách hàng nào" 
                      description={isTopSpenders ? "Chưa có dữ liệu chi tiêu." : "Thử thay đổi từ khóa hoặc bộ lọc của bạn."} 
                    />
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className={`transition-colors group ${!customer.isActive ? 'bg-slate-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-5 py-4">
                      <div className={`font-bold text-[14px] leading-snug ${!customer.isActive ? 'text-slate-500' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>
                        {customer.fullName}
                      </div>
                      <div className="text-slate-400 font-medium text-xs mt-1.5 truncate max-w-[250px]" title={customer.notes}>
                        {customer.notes || <span className="italic opacity-70">Không có ghi chú</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`font-mono font-bold tracking-tight text-[13px] ${!customer.isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                        {customer.phoneNumber}
                      </div>
                      {customer.email && (
                        <div className="text-slate-500 text-[11px] font-medium mt-0.5">
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className={`flex flex-col items-start gap-1.5 ${!customer.isActive ? 'opacity-60' : ''}`}>
                        {renderTierBadge(customer.customerTier)}
                        <span className="text-[11px] font-bold text-slate-500">
                          <span className="text-slate-700">{customer.loyaltyPoints}</span> điểm
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className={`font-black text-[15px] tracking-tight ${!customer.isActive ? 'text-slate-400' : 'text-indigo-600'}`}>
                        {customer.totalSpent?.toLocaleString('vi-VN')} <span className="text-xs">đ</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                        customer.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {customer.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setHistoryCustomer(customer); setIsHistoryOpen(true); }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors" 
                          title="Xem lịch sử giao dịch"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(customer)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 transition-colors" 
                          title="Cập nhật thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleToggleActive(customer)} 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            customer.isActive 
                              ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700' 
                              : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700'
                          }`} 
                          title={customer.isActive ? 'Khóa khách hàng' : 'Mở khóa khách hàng'}
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

        {/* ── PAGINATION ── */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <Pagination 
              page={page} 
              totalPages={totalPages} 
              totalElements={totalElements} 
              size={size} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <CustomerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveCustomer} 
        customerId={editingCustomerId} 
      />
      <CustomerHistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        customer={historyCustomer} 
      />
    </div>
  );
}