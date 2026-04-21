import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Edit, Power, Trophy, Filter, Clock, Download, Upload, Users, ChevronDown, DollarSign, Activity } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { customerService } from '@/services/customer.service';
import type { Customer } from '@/types';
import { CustomerModal } from '@/pages/CustomerModal';
import { CustomerHistoryModal } from '@/pages/CustomerHistoryModal';
import toast from 'react-hot-toast';
import { Spinner, Pagination, EmptyState } from '@/components/ui'; 
import * as XLSX from 'xlsx'; 

// --- CẤU HÌNH TOOLTIP CHO BIỂU ĐỒ ---
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
          <span className="text-sm font-black text-slate-900">{payload[0].value} khách</span>
        </div>
      </div>
    );
  }
  return null;
};

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
  const size = 15; 

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
          toast.error('File Excel rỗng hoặc thiếu cột (Tên Khách Hàng, Số Điện Thoại).', { id: toastId });
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
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // --- TÍNH TOÁN DATA CHO MINI DASHBOARD ---
  const dashboardStats = useMemo(() => {
    let totalSpent = 0;
    const tierCount: Record<string, { count: number, color: string, label: string }> = {
      STANDARD: { count: 0, color: '#3b82f6', label: 'Tiêu chuẩn' }, // Blue
      SILVER: { count: 0, color: '#94a3b8', label: 'Hạng Bạc' },     // Slate
      GOLD: { count: 0, color: '#f59e0b', label: 'Hạng Vàng' },       // Amber
    };

    customers.forEach(c => {
      totalSpent += Number(c.totalSpent || 0);
      if (tierCount[c.customerTier]) {
        tierCount[c.customerTier].count++;
      } else {
        tierCount['STANDARD'].count++; // Fallback
      }
    });

    const chartData = Object.values(tierCount).filter(t => t.count > 0).map(t => ({
      name: t.label, value: t.count, color: t.color
    }));

    return { totalSpent, chartData };
  }, [customers]);

  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case 'GOLD': 
        return <span className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200/60 shadow-sm">Hạng Vàng</span>;
      case 'SILVER': 
        return <span className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 shadow-sm">Hạng Bạc</span>;
      default: 
        return <span className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200/60 shadow-sm">Tiêu chuẩn</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Khách hàng</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Xem, thêm mới, cập nhật và quản lý phân hạng thẻ thành viên.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm flex-1 sm:flex-none disabled:opacity-50"
          >
            {isImporting ? <Spinner size="sm" className="text-slate-700" /> : <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Nhập</span></>}
          </button>
          
          {/* Input file ẩn */}
          <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
          
          <button 
            onClick={() => handleOpenModal()} 
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all flex-1 sm:flex-none"
          >
            <Plus className="w-5 h-5" /> Thêm Khách hàng
          </button>
        </div>
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Card 1: Tổng số phiếu */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Users className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Khách hàng trang này</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{customers.length} <span className="text-sm font-bold text-slate-400">/ {totalElements}</span></h3>
            </div>
          </div>
          <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Tổng chi tiêu (trang này)</span>
             <span className="font-black text-indigo-600 text-base">{dashboardStats.totalSpent.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {/* Card 2: Biểu đồ trạng thái */}
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
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu hạng thẻ (Trang này)</p>
            <div className="space-y-3">
              {dashboardStats.chartData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{d.value} <span className="text-xs font-medium text-slate-400 ml-1">người</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC BẢNG DỮ LIỆU & BỘ LỌC ── */}
      <div className={`bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border overflow-hidden flex flex-col animate-fade-in transition-colors ${isTopSpenders ? 'border-amber-200' : 'border-slate-100'}`}>
        
        {/* Toolbar */}
        <div className={`p-5 border-b flex flex-col lg:flex-row justify-between gap-4 transition-colors ${isTopSpenders ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100 bg-white'}`}>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Tìm theo Tên, Số điện thoại hoặc Email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                disabled={isTopSpenders}
                className={`w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
                  isTopSpenders 
                    ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed" 
                    : "bg-slate-50 border border-slate-200 focus:bg-white text-slate-900"
                }`}
              />
            </div>

            <div className="relative w-full sm:w-56 shrink-0 group">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select
                 value={tierFilter}
                 onChange={(e) => { setTierFilter(e.target.value); setPage(0); }}
                 disabled={isTopSpenders} 
                 className={`w-full pl-11 pr-10 py-3 rounded-xl text-sm font-bold outline-none transition-all appearance-none cursor-pointer ${
                   isTopSpenders 
                     ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed" 
                     : "bg-slate-50 border border-slate-200 focus:bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                 }`}
               >
                 <option value="">Tất cả hạng thẻ</option>
                 <option value="STANDARD">Hạng Tiêu chuẩn</option>
                 <option value="SILVER">Hạng Bạc</option>
                 <option value="GOLD">Hạng Vàng</option>
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <button
              onClick={() => { setIsTopSpenders(!isTopSpenders); setPage(0); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all text-sm font-bold shadow-sm ${
                isTopSpenders 
                  ? 'bg-amber-100 border border-amber-300 text-amber-800 shadow-amber-200/50' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Trophy className={`w-4 h-4 ${isTopSpenders ? 'text-amber-600' : 'text-slate-400'}`} />
              {isTopSpenders ? 'Đang xem Top Chi Tiêu' : 'Lọc Top Chi Tiêu'}
            </button>
          </div>
          {isTopSpenders && (
             <span className="text-[11px] font-bold text-amber-600 block md:hidden w-full mt-[-8px]">
               * Tìm kiếm & Lọc bị vô hiệu hóa.
             </span>
          )}
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {isRefetching && !loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          )}

          <table className="w-full text-left text-sm text-slate-600">
            <thead className={`text-[11px] text-slate-500 uppercase font-bold sticky top-0 z-10 border-b border-slate-100 tracking-wider ${isTopSpenders ? 'bg-amber-50/50' : 'bg-slate-50/50'}`}>
              <tr>
                <th className="px-6 py-5">Khách hàng</th>
                <th className="px-6 py-5">Liên hệ</th>
                <th className="px-6 py-5 text-center">Hạng thẻ</th>
                <th className="px-6 py-5 text-right">Tổng chi tiêu</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right w-44">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <Spinner size="lg" className="mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <EmptyState 
                      icon={Users} 
                      title="Không tìm thấy khách hàng nào" 
                      description={isTopSpenders ? "Chưa có dữ liệu chi tiêu." : "Thử thay đổi từ khóa hoặc bộ lọc của bạn."} 
                    />
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className={`transition-colors group ${!customer.isActive ? 'bg-slate-50/30' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-6 py-4">
                      <div className={`font-bold text-[14px] leading-snug ${!customer.isActive ? 'text-slate-400' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>
                        {customer.fullName}
                      </div>
                      <div className="text-slate-400 font-medium text-xs mt-1.5 truncate max-w-[250px]" title={customer.notes}>
                        {customer.notes || <span className="italic opacity-60">Không có ghi chú</span>}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className={`font-mono font-bold tracking-tight text-[13px] ${!customer.isActive ? 'text-slate-400' : 'text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max'}`}>
                        {customer.phoneNumber}
                      </div>
                      {customer.email && (
                        <div className="text-slate-500 text-[11px] font-medium mt-1.5">
                          {customer.email}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className={`flex flex-col items-center gap-1.5 ${!customer.isActive ? 'opacity-60' : ''}`}>
                        {renderTierBadge(customer.customerTier)}
                        <span className="text-[11px] font-bold text-slate-400">
                          <span className="text-slate-600">{customer.loyaltyPoints}</span> điểm
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-[16px] tracking-tight ${!customer.isActive ? 'text-slate-400' : 'text-indigo-600'}`}>
                        {customer.totalSpent?.toLocaleString('vi-VN')} <span className="text-[11px]">đ</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${
                        customer.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' 
                          : 'bg-rose-50 text-rose-700 border-rose-100/60'
                      }`}>
                        {customer.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setHistoryCustomer(customer); setIsHistoryOpen(true); }} 
                          className="p-1.5 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors" 
                          title="Xem lịch sử giao dịch"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(customer)} 
                          className="p-1.5 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 transition-colors" 
                          title="Cập nhật thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleToggleActive(customer)} 
                          className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                            customer.isActive 
                              ? 'text-rose-500 hover:bg-rose-50' 
                              : 'text-emerald-600 hover:bg-emerald-50'
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
          <div className={`border-t p-4 transition-colors ${isTopSpenders ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
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
cu
      {/* CSS Animation Slide */}
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