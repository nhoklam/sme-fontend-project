import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Search, Filter, History, SlidersHorizontal, MapPin, FolderTree, Download, DollarSign, BellRing, X, Box } from 'lucide-react';
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
  { value: 'LOW_STOCK', label: 'Sắp hết hàng (Dưới định mức)' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng (Tồn = 0)' },
];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <BellRing className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Cài đặt định mức</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-1">Sản phẩm</p>
            <p className="font-bold text-slate-800 leading-tight">{inventory.productName}</p>
            {inventory.productSku && <p className="font-mono text-xs text-slate-400 mt-1">SKU: {inventory.productSku}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 text-center">Định mức an toàn tối thiểu <span className="text-rose-500">*</span></label>
            <input 
              type="number" 
              min={0} 
              className="w-full bg-white border-2 border-indigo-100 text-indigo-600 text-2xl font-black rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 block p-4 text-center transition-all outline-none" 
              value={minQty} 
              onChange={e => setMinQty(parseInt(e.target.value) || 0)} 
              autoFocus 
            />
            <p className="text-[11px] font-medium text-slate-500 text-center mt-2">Hệ thống sẽ cảnh báo khi Tồn khả dụng thấp hơn mức này.</p>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">Hủy bỏ</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || minQty < 0} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[120px]">
            {mut.isPending ? <Spinner size="sm" className="text-white"/> : 'Lưu cài đặt'}
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
    enabled: !!selectedWarehouseId,
  });

  const safeInventoryValue = Array.isArray(inventoryValueData) ? inventoryValueData : [];
  const totalSystemQty = safeInventoryValue.reduce((sum, item) => sum + Number(item.total_qty ?? 0), 0);
  const totalSystemValue = safeInventoryValue.reduce((sum, item) => sum + Number(item.total_value ?? 0), 0);

  useEffect(() => {
    if (isAdmin() && warehouses?.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
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
    enabled: !!selectedWarehouseId,
  });

  const { data: lowStockAlerts } = useQuery({
    queryKey: ['low-stock', selectedWarehouseId],
    queryFn: () => inventoryService.getLowStock(selectedWarehouseId).then((r: any) => r.data.data),
    enabled: !!selectedWarehouseId,
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
      const warehouseName = warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name || 'Tat_Ca';
      XLSX.writeFile(workbook, `TonKho_${warehouseName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Xuất file Excel thành công!');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const inventoryList = pagedData?.content || [];

  if (isAdmin() && !selectedWarehouseId) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Box className="w-6 h-6 text-indigo-600" /> Quản lý Tồn kho
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi số lượng hàng hóa thực tế và khả dụng</p>
          </div>

          {isAdmin() && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200/60 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all mt-2 sm:mt-0 sm:ml-4">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(0); }}
                className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6 w-full outline-none"
              >
                {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting} 
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <button 
            onClick={() => setShowQuickLookup(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 flex-1 sm:flex-none justify-center"
          >
            <Search className="w-4 h-4 mr-2" /> Tra cứu nhanh
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group">
          <div className="p-4 rounded-xl bg-blue-50 text-blue-600 ring-4 ring-blue-50/50 transition-transform group-hover:scale-110">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Tổng số lượng tồn (Vật lý)</p>
            <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{totalSystemQty.toLocaleString('vi-VN')} <span className="text-lg font-bold text-slate-400 ml-1">SP</span></p>
          </div>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group">
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50 transition-transform group-hover:scale-110">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Tổng giá trị vốn (MAC)</p>
            <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalSystemValue)}</p>
          </div>
        </div>
      </div>

      {/* ── CẢNH BÁO TỒN KHO ── */}
      {(lowStockAlerts ?? []).length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-start sm:items-center gap-4 shadow-sm animate-fade-in">
          <div className="p-2.5 bg-rose-200 text-rose-700 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="font-extrabold text-rose-800 text-base">Cảnh báo: Có {lowStockAlerts!.length} sản phẩm sắp hết hàng!</p>
            <p className="text-rose-600/80 font-medium text-sm mt-0.5">Vui lòng kiểm tra danh sách bên dưới và lên kế hoạch nhập hàng để tránh gián đoạn kinh doanh.</p>
          </div>
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        {/* Tìm kiếm */}
        <div className="relative w-full lg:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium"
            placeholder="Tìm theo tên sản phẩm, mã vạch, SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 flex-col sm:flex-row">
          {/* Danh mục */}
          <div className="relative flex-1 sm:w-56 shrink-0">
            <FolderTree className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={selectedCategoryId}
              onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(0); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
            >
              <option value="">Tất cả danh mục</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Trạng thái */}
          <div className="relative flex-1 sm:w-56 shrink-0">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
            >
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative min-h-[300px]">
        {loadingInv && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}
        
        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[1100px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4">Mã vạch / SKU</th>
                <th className="px-5 py-4 text-center">Tồn vật lý</th>
                <th className="px-5 py-4 text-center text-amber-600" title="Hàng khách đã đặt Online nhưng chưa giao">Giữ chỗ</th>
                <th className="px-5 py-4 text-center text-blue-600" title="Hàng đang trên đường chuyển kho">Đang về</th>
                <th className="px-5 py-4 text-center text-emerald-700">Khả dụng (Web)</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventoryList.length === 0 && !loadingInv ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <EmptyState 
                      icon={Package} 
                      title="Không tìm thấy sản phẩm nào" 
                      description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc" 
                    />
                  </td>
                </tr>
              ) : (
                inventoryList.map((inv: InventoryResponse) => (
                  <tr 
                    key={inv.productId} 
                    className={`transition-colors group ${
                      inv.quantity <= 0 ? 'bg-rose-50/40 hover:bg-rose-50/80' : 
                      inv.lowStock ? 'bg-amber-50/30 hover:bg-amber-50/60' : 
                      'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-100 shadow-sm overflow-hidden">
                          {inv.productImageUrl ? (
                            <img src={inv.productImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[14px] max-w-[280px] line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors" title={inv.productName}>
                            {inv.productName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-mono font-bold text-[13px] text-slate-600">{inv.isbnBarcode || '-'}</p>
                      {inv.productSku && <p className="font-mono text-[11px] font-semibold text-slate-400 mt-1">SKU: {inv.productSku}</p>}
                    </td>
                    
                    <td className="px-5 py-4 text-center font-black text-slate-800 text-lg tracking-tight">{inv.quantity}</td>
                    
                    <td className="px-5 py-4 text-center font-bold text-amber-600 text-base">{inv.reservedQuantity > 0 ? inv.reservedQuantity : '-'}</td>
                    
                    <td className="px-5 py-4 text-center font-bold text-blue-600 text-base">{inv.inTransit > 0 ? inv.inTransit : '-'}</td>
                    
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg text-[15px] font-black tracking-tight border shadow-sm ${
                        inv.availableQuantity <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {inv.availableQuantity}
                      </span>
                    </td>
                    
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {inv.quantity <= 0 ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">Hết hàng</span>
                        ) : inv.lowStock ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-100 text-amber-700 border border-amber-200 shadow-sm" title={`Định mức an toàn: ${inv.minQuantity}`}>⚠ Sắp hết</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">Đủ hàng</span>
                        )}
                        <p className="text-[11px] font-semibold text-slate-400">Min: <span className="font-bold text-slate-600">{inv.minQuantity}</span></p>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSettingMinQty(inv)} 
                          disabled={!inv.id} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                          title="Cài đặt định mức an toàn"
                        >
                          <BellRing className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setViewingHistory(inv)} 
                          disabled={!inv.id} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                          title="Xem thẻ kho (Lịch sử biến động)"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setAdjustingItem(inv)} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors" 
                          title="Kiểm kê / Điều chỉnh số lượng"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
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
            <Pagination page={page} totalPages={pagedData.totalPages} totalElements={pagedData.totalElements} size={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {viewingHistory && <InventoryHistoryModal inventory={viewingHistory} onClose={() => setViewingHistory(null)} />}
      {adjustingItem && <InventoryAdjustModal inventory={adjustingItem} onClose={() => setAdjustingItem(null)} onSuccess={() => qc.invalidateQueries({ queryKey: ['inventory-search'] })} />}
      {settingMinQty && <MinQuantityModal inventory={settingMinQty} onClose={() => setSettingMinQty(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['inventory-search'] })} />}
      {showQuickLookup && <InventoryQuickLookupModal products={[]} selectedWarehouseId={selectedWarehouseId} onClose={() => setShowQuickLookup(false)} />}
    </div>
  );
}