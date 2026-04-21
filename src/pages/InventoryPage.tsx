import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Search, Filter, History, SlidersHorizontal, MapPin, FolderTree, Download, DollarSign, BellRing, X, Box, ChevronDown, Activity } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { Client } from '@stomp/stompjs';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { inventoryService, InventoryResponse } from '../services/inventory.service';
import { warehouseService } from '../services/warehouse.service';
import { categoryService } from '../services/category.service';
import { reportService } from '../services/report.service';

import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/auth.store';
import { PageLoader, EmptyState, Pagination, Spinner } from '../components/ui';

import { InventoryHistoryModal } from './InventoryHistoryModal';
import InventoryAdjustModal from './InventoryAdjustModal';
import { InventoryQuickLookupModal } from './InventoryQuickLookupModal';
import api from '../lib/axios';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'IN_STOCK', label: 'Còn hàng' },
  { value: 'LOW_STOCK', label: 'Sắp hết hàng (Dưới Min)' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng (Tồn = 0)' },
];

// --- CẤU HÌNH TOOLTIP & MÀU BIỂU ĐỒ ---
const CHART_COLORS = ['#4f46e5', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#0284c7'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[180px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{payload[0].name}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
              <span className="text-sm font-medium text-slate-500">Giá trị:</span>
            </div>
            <span className="text-sm font-black text-slate-900">{formatCurrency(payload[0].value)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3 text-slate-400 ml-0.5" />
              <span className="text-sm font-medium text-slate-500">Số lượng:</span>
            </div>
            <span className="text-sm font-bold text-slate-700">{payload[0].payload.qty?.toLocaleString('vi-VN')} SP</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ── MIN QUANTITY MODAL REDESIGNED ──
function MinQuantityModal({ inventory, onClose, onSaved }: { inventory: any, onClose: () => void, onSaved: () => void }) {
  const [minQty, setMinQty] = useState(inventory.minQuantity || 0);

  const mut = useMutation({
    mutationFn: () => inventoryService.updateMinQuantity(inventory.id, minQty),
    onSuccess: () => {
      toast.success('Đã cập nhật định mức an toàn!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật định mức'),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 shrink-0">
          <div>
            <h3 className="font-bold text-xl text-slate-900 tracking-tight">Định mức an toàn</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">Cảnh báo khi tồn kho xuống thấp</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6 bg-slate-50/30">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Package className="w-3.5 h-3.5"/> Sản phẩm</p>
            <p className="font-bold text-slate-800 leading-snug">{inventory.productName}</p>
            {inventory.productSku && <p className="font-mono text-xs font-semibold text-slate-500 mt-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 w-max">SKU: {inventory.productSku}</p>}
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">Mức tối thiểu (Min Qty) <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              min={0} 
              className="w-full bg-white border-2 border-indigo-100 text-indigo-600 text-3xl font-black rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-5 text-center transition-all outline-none shadow-inner" 
              value={minQty} 
              onChange={e => setMinQty(parseInt(e.target.value) || 0)} 
              autoFocus 
            />
            <p className="text-xs font-medium text-slate-500 text-center mt-3 flex items-center justify-center gap-1.5"><BellRing className="w-3.5 h-3.5 text-amber-500"/> Hệ thống sẽ báo đỏ khi Tồn khả dụng &lt; {minQty}</p>
          </div>
        </div>
        
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || minQty < 0} className="flex items-center justify-center min-w-[130px] px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all">
            {mut.isPending ? <Spinner size="sm" className="text-white"/> : 'Lưu thiết lập'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──
export default function InventoryPage() {
  const { user, isAdmin } = useAuthStore();
  
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(!isAdmin() ? (user?.warehouseId || '') : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const [viewingHistory, setViewingHistory] = useState<any | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<any | null>(null);
  const [settingMinQty, setSettingMinQty] = useState<any | null>(null);
  const [showQuickLookup, setShowQuickLookup] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const qc = useQueryClient();
  const stompClientRef = useRef<Client | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-inv'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
    enabled: isAdmin(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-inv'],
    queryFn: () => categoryService.getAll().then((r: any) => r.data.data),
  });

  const { data: inventoryValueData } = useQuery({
    queryKey: ['inventory-value', selectedWarehouseId],
    queryFn: () => reportService.getInventoryValue(selectedWarehouseId).then((r: any) => r.data.data),
    enabled: !!selectedWarehouseId || isAdmin(), // Sửa để Admin thấy data tổng
  });

  const safeInventoryValue = Array.isArray(inventoryValueData) ? inventoryValueData : [];
  const totalSystemQty = safeInventoryValue.reduce((sum, item) => sum + Number(item.total_qty ?? 0), 0);
  const totalSystemValue = safeInventoryValue.reduce((sum, item) => sum + Number(item.total_value ?? 0), 0);

  // Tính toán dữ liệu Biểu đồ Tỷ trọng vốn
  const dashboardChartData = useMemo(() => {
    if (safeInventoryValue.length === 0) return [];
    return safeInventoryValue.map((w, i) => ({
      name: w.warehouse_name || w.warehouseName || 'Chi nhánh',
      value: Number(w.total_value || 0),
      qty: Number(w.total_qty || 0),
      color: CHART_COLORS[i % CHART_COLORS.length]
    })).filter(d => d.value > 0);
  }, [safeInventoryValue]);

  useEffect(() => {
    if (isAdmin() && warehouses?.length > 0 && !selectedWarehouseId) {
      // Để trống '' (Toàn hệ thống) mặc định cho Admin thay vì tự chọn kho 0
      // setSelectedWarehouseId(warehouses[0].id); 
    }
  }, [warehouses, isAdmin, selectedWarehouseId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: pagedData, isLoading: loadingInv } = useQuery({
    queryKey: ['inventory-search', selectedWarehouseId, debouncedSearch, selectedCategoryId, statusFilter, page],
    queryFn: () => inventoryService.searchInventory(selectedWarehouseId, {
      keyword: debouncedSearch || undefined,
      categoryId: selectedCategoryId || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      size: PAGE_SIZE
    }).then(r => r.data.data),
    // Sửa enable để Admin có thể xem toàn hệ thống (nếu BE support) hoặc yêu cầu chọn kho
    enabled: isAdmin() ? true : !!selectedWarehouseId, 
  });

  const { data: lowStockAlerts } = useQuery({
    queryKey: ['low-stock', selectedWarehouseId],
    queryFn: () => inventoryService.getLowStock(selectedWarehouseId).then((r: any) => r.data.data),
    enabled: isAdmin() ? true : !!selectedWarehouseId,
  });

  // WebSocket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !selectedWarehouseId) return;
    if (stompClientRef.current && stompClientRef.current.active) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const brokerURL = (import.meta as any).env.VITE_WS_URL || `${wsProtocol}//${wsHost}:8080/api/ws`;

    const client = new Client({
      brokerURL: brokerURL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        const topic = `/topic/warehouse/${selectedWarehouseId}/low-stock`;
        client.subscribe(topic, (message) => {
          const payload = JSON.parse(message.body);
          toast.error(`⚠️ Cảnh báo: Sản phẩm "${payload.productName || 'Không xác định'}" vừa rớt xuống dưới mức an toàn! (Còn ${payload.quantity} SP)`, {
            duration: 5000,
          });
          qc.refetchQueries({ queryKey: ['inventory-search'] });
          qc.refetchQueries({ queryKey: ['low-stock'] });
        });
      }
    });

    stompClientRef.current = client;
    client.activate();

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
    };
  }, [selectedWarehouseId, qc]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await inventoryService.searchInventory(selectedWarehouseId, {
        keyword: debouncedSearch || undefined,
        categoryId: selectedCategoryId || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 0,
        size: 10000
      });
      
      const exportData = res.data.data.content;
      if (!exportData || exportData.length === 0) {
        toast.error('Không có dữ liệu để xuất Excel');
        return;
      }

      const excelData = exportData.map((inv: InventoryResponse, index: number) => ({
        'STT': index + 1,
        'Mã Sản Phẩm': inv.productSku || '',
        'Tên Sản Phẩm': inv.productName,
        'Mã Vạch/ISBN': inv.isbnBarcode || '',
        'Danh Mục': inv.categoryName || '',
        'Tồn Vật Lý': inv.quantity,
        'Đang Giữ Chỗ': inv.reservedQuantity,
        'Đang Trên Đường (Về)': inv.inTransit,
        'Khả Dụng (Web)': inv.availableQuantity,
        'Mức Tối Thiểu': inv.minQuantity,
        'Trạng Thái': inv.quantity <= 0 ? 'Hết hàng' : inv.lowStock ? 'Sắp hết' : 'Đủ hàng',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");
      const warehouseName = warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name || 'Tat_Ca_Chi_Nhanh';
      XLSX.writeFile(workbook, `TonKho_${warehouseName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Xuất file Excel thành công!');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const inventoryList = pagedData?.content || [];

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Tồn kho</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi số lượng thực tế, giá trị vốn và cảnh báo hàng hóa.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting} 
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 flex-1 md:flex-none"
          >
            <Download className="w-4 h-4" /> {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button 
            onClick={() => setShowQuickLookup(true)} 
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all flex-1 md:flex-none"
          >
            <Search className="w-4 h-4" /> Tra cứu nhanh
          </button>
        </div>
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Card 1: Tổng quan số lượng */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Box className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng sản phẩm hiện tồn</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{totalSystemQty.toLocaleString('vi-VN')}</h3>
            </div>
          </div>
          <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng Giá Trị Vốn</span>
             <span className="font-black text-teal-600 text-base">{formatCurrency(totalSystemValue)}</span>
          </div>
        </div>

        {/* Card 2: Biểu đồ tỷ trọng (Theo kho hoặc Trạng thái) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-8">
          <div className="w-1/3 h-[120px] relative shrink-0">
            {dashboardChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardChartData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu Giá trị vốn ({!selectedWarehouseId ? 'Theo chi nhánh' : 'Chi nhánh này'})</p>
            <div className="space-y-3">
              {dashboardChartData.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{formatCurrency(d.value)}</span>
                </div>
              ))}
              {dashboardChartData.length > 3 && (
                <p className="text-[11px] text-slate-400 font-medium italic mt-2">+ {dashboardChartData.length - 3} nhánh khác</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CẢNH BÁO TỒN KHO ── */}
      {(lowStockAlerts ?? []).length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex items-start sm:items-center gap-5 shadow-[0_4px_24px_rgb(0,0,0,0.02)] animate-fade-in">
          <div className="p-3 bg-rose-200 text-rose-700 rounded-2xl shrink-0 shadow-sm">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="font-extrabold text-rose-800 text-lg tracking-tight mb-1">Hành động cần thiết: Có {lowStockAlerts!.length} sản phẩm sắp chạm đáy tồn kho!</p>
            <p className="text-rose-600/90 font-medium text-sm">Vui lòng lọc theo trạng thái "Sắp hết hàng" bên dưới và lên kế hoạch nhập hàng để tránh gián đoạn kinh doanh.</p>
          </div>
        </div>
      )}

      {/* ── KHU VỰC BẢNG DỮ LIỆU & BỘ LỌC ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm tên sản phẩm, mã vạch, SKU..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative w-full sm:w-48 shrink-0 group">
               <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={selectedCategoryId} 
                 onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(0); }}
               >
                 <option value="">Tất cả danh mục</option>
                 {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-48 shrink-0 group">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={statusFilter} 
                 onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
               >
                 {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            {isAdmin() && (
              <div className="relative w-full sm:w-56 shrink-0 group">
                 <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                 <select 
                   className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                   value={selectedWarehouseId} 
                   onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(0); }}
                 >
                   <option value="">-- Toàn hệ thống --</option>
                   {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                 </select>
                 <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {loadingInv && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Sản phẩm</th>
                <th className="px-6 py-5">Mã Barcode / SKU</th>
                <th className="px-6 py-5 text-center">Tồn hệ thống</th>
                <th className="px-6 py-5 text-center text-amber-600" title="Hàng khách đã đặt Online nhưng chưa giao">Giữ chỗ</th>
                <th className="px-6 py-5 text-center text-blue-600" title="Hàng đang trên đường chuyển kho">Đang về</th>
                <th className="px-6 py-5 text-center text-emerald-700">Tồn khả dụng</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {inventoryList.length === 0 && !loadingInv ? (
                <tr>
                  <td colSpan={8} className="py-24">
                    <EmptyState 
                      icon={Package} 
                      title="Không tìm thấy sản phẩm nào" 
                      description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc." 
                    />
                  </td>
                </tr>
              ) : (
                inventoryList.map((inv: InventoryResponse) => (
                  <tr 
                    key={inv.productId} 
                    className={`transition-colors group ${
                      inv.quantity <= 0 ? 'bg-rose-50/30 hover:bg-rose-50/70' : 
                      inv.lowStock ? 'bg-amber-50/20 hover:bg-amber-50/60' : 
                      'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden bg-white shrink-0 shadow-sm flex items-center justify-center">
                          {inv.productImageUrl ? (
                            <img src={inv.productImageUrl} alt={inv.productName} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900 text-[14px] line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors" title={inv.productName}>
                          {inv.productName}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max">{inv.isbnBarcode || '-'}</span>
                        {inv.productSku && <span className="font-mono text-[11px] font-semibold text-slate-400">SKU: {inv.productSku}</span>}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="font-black text-slate-800 text-[17px] tracking-tight">{inv.quantity}</span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-amber-600 text-[15px]">{inv.reservedQuantity > 0 ? inv.reservedQuantity : '-'}</span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-blue-600 text-[15px]">{inv.inTransit > 0 ? inv.inTransit : '-'}</span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-xl text-[16px] font-black tracking-tight border shadow-sm ${
                        inv.availableQuantity <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100/60'
                      }`}>
                        {inv.availableQuantity}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {inv.quantity <= 0 ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">Hết hàng</span>
                        ) : inv.lowStock ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-100 text-amber-700 border border-amber-200 shadow-sm" title={`Định mức an toàn: ${inv.minQuantity}`}>⚠ Sắp hết</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">Đủ hàng</span>
                        )}
                        <span className="text-[11px] font-semibold text-slate-400">Min: <span className="font-bold text-slate-600">{inv.minQuantity}</span></span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setAdjustingItem(inv)} 
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                          title="Kiểm kê / Điều chỉnh kho"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setViewingHistory(inv)} 
                          disabled={!inv.id} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30" 
                          title="Xem thẻ kho"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSettingMinQty(inv)} 
                          disabled={!inv.id} 
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-30" 
                          title="Định mức tồn kho"
                        >
                          <BellRing className="w-4 h-4" />
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination page={page} totalPages={pagedData.totalPages} totalElements={pagedData.totalElements} size={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {viewingHistory && <InventoryHistoryModal inventory={viewingHistory} onClose={() => setViewingHistory(null)} />}
      {adjustingItem && <InventoryAdjustModal inventory={adjustingItem} onClose={() => setAdjustingItem(null)} onSuccess={() => qc.invalidateQueries({ queryKey: ['inventory-search'] })} />}
      {settingMinQty && <MinQuantityModal inventory={settingMinQty} onClose={() => setSettingMinQty(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['inventory-search'] })} />}
      {showQuickLookup && <InventoryQuickLookupModal products={[]} selectedWarehouseId={selectedWarehouseId} onClose={() => setShowQuickLookup(false)} />}
      
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