import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Search, Filter, History, SlidersHorizontal, MapPin, FolderTree, Download, DollarSign, BellRing, X } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { inventoryService } from '../services/inventory.service';
import { productService } from '../services/product.service';
import { warehouseService } from '../services/warehouse.service';
import { categoryService } from '../services/category.service';
import { reportService } from '../services/report.service';
import api from '../lib/axios';

import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/auth.store';
import { PageLoader, EmptyState, Pagination, Spinner } from '../components/ui';

import { InventoryHistoryModal } from './InventoryHistoryModal';
import { InventoryAdjustModal } from './InventoryAdjustModal';
import { InventoryQuickLookupModal } from './InventoryQuickLookupModal';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'IN_STOCK', label: 'Còn hàng' },
  { value: 'LOW_STOCK', label: 'Sắp hết hàng (Dưới định mức)' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng (Tồn = 0)' },
];

function MinQuantityModal({ inventory, onClose, onSaved }: { inventory: any, onClose: () => void, onSaved: () => void }) {
  const [minQty, setMinQty] = useState(inventory.minQuantity || 0);

  const mut = useMutation({
    mutationFn: () => api.put(`/inventory/${inventory.id}/min-quantity`, { minQuantity: minQty }),
    onSuccess: () => {
      toast.success('Đã cập nhật định mức an toàn!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi cập nhật định mức'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b bg-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <BellRing className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Cài đặt định mức</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Sản phẩm</p>
            <p className="font-semibold text-gray-800">{inventory.product?.name}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-600">
            Hệ thống sẽ gửi cảnh báo màu đỏ khi số lượng <span className="font-bold text-gray-800">Tồn vật lý</span> giảm xuống dưới hoặc bằng mức này.
          </div>
          <div>
            <label className="label">Định mức tối thiểu (Min Quantity) <span className="text-red-500">*</span></label>
            <input 
              type="number" min={0} 
              className="input text-lg font-bold py-3 text-center" 
              value={minQty} 
              onChange={e => setMinQty(parseInt(e.target.value) || 0)} 
              autoFocus
            />
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-6">Hủy</button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || minQty < 0}
            className="btn-primary px-6 bg-purple-600 hover:bg-purple-700 border-none"
          >
            {mut.isPending ? <Spinner size="sm" /> : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, selectedCategoryId]);

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
          // <-- ĐÃ SỬA: Hiển thị payload.productName thay vì "Một sản phẩm"
          toast.error(`⚠️ Cảnh báo: Sản phẩm "${payload.productName || 'Không xác định'}" vừa rớt xuống dưới mức an toàn! (Còn ${payload.quantity} SP)`, {
            duration: 5000,
          });
          qc.refetchQueries({ queryKey: ['inventory', selectedWarehouseId] });
          qc.refetchQueries({ queryKey: ['low-stock', selectedWarehouseId] });
          qc.refetchQueries({ queryKey: ['inventory-value', selectedWarehouseId] });
        });
      },
      onStompError: (frame) => console.error('❌ [STOMP ERROR]:', frame.headers['message'])
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

  const { data: inventory, isLoading: loadingInv } = useQuery({
    queryKey: ['inventory', selectedWarehouseId],
    queryFn: () => inventoryService.getByWarehouse(selectedWarehouseId).then((r: any) => r.data.data),
    enabled: !!selectedWarehouseId,
  });

  const { data: lowStockAlerts } = useQuery({
    queryKey: ['low-stock', selectedWarehouseId],
    queryFn: () => inventoryService.getLowStock(selectedWarehouseId).then((r: any) => r.data.data),
    enabled: !!selectedWarehouseId,
  });

  const { data: productsData, isLoading: loadingProd } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 10000 }).then((r: any) => r.data.data.content),
  });

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    productsData?.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [productsData]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    
    let result = inventory.map((inv: any) => ({
      ...inv,
      product: productMap.get(inv.productId) || null
    }));

    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      result = result.filter((inv: any) => 
        inv.product?.name?.toLowerCase().includes(lower) ||
        inv.product?.isbnBarcode?.toLowerCase().includes(lower) ||
        inv.product?.sku?.toLowerCase().includes(lower)
      );
    }

    if (selectedCategoryId) {
      result = result.filter((inv: any) => inv.product?.categoryId === selectedCategoryId);
    }

    if (statusFilter === 'LOW_STOCK') {
      result = result.filter((inv: any) => inv.lowStock);
    } else if (statusFilter === 'OUT_OF_STOCK') {
      result = result.filter((inv: any) => inv.availableQuantity <= 0);
    } else if (statusFilter === 'IN_STOCK') {
      result = result.filter((inv: any) => inv.availableQuantity > 0 && !inv.lowStock);
    }

    return result;
  }, [inventory, productMap, debouncedSearch, statusFilter, selectedCategoryId]);

  const paginatedInventory = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredInventory.slice(start, start + PAGE_SIZE);
  }, [filteredInventory, page]);

  const totalPages = Math.ceil(filteredInventory.length / PAGE_SIZE);

  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      
      if (!filteredInventory || filteredInventory.length === 0) {
        toast.error('Không có dữ liệu để xuất Excel');
        return;
      }

      const excelData = filteredInventory.map((inv: any, index: number) => {
        return {
          'STT': index + 1,
          'Mã Sản Phẩm': inv.product?.sku || '',
          'Tên Sản Phẩm': inv.product?.name || 'Không xác định',
          'Mã Vạch/ISBN': inv.product?.isbnBarcode || '',
          'Danh Mục': categories?.find((c: any) => c.id === inv.product?.categoryId)?.name || '',
          'Tồn Vật Lý': inv.quantity,
          'Đang Giữ Chỗ': inv.reservedQuantity,
          'Đang Trên Đường (Về)': inv.inTransit,
          'Khả Dụng (Web)': inv.availableQuantity,
          'Mức Tối Thiểu': inv.minQuantity,
          'Trạng Thái': inv.lowStock ? 'Sắp hết' : (inv.availableQuantity <= 0 ? 'Hết hàng' : 'Đủ hàng'),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");

      worksheet['!cols'] = [
        { wch: 5 },  { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 20 },
        { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
      ];

      const warehouseName = warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name || 'Tat_Ca';
      const fileName = `TonKho_${warehouseName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast.success('Xuất file Excel thành công!');
    } catch (error) {
      console.error("Lỗi xuất Excel:", error);
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (loadingInv || loadingProd || (isAdmin() && !selectedWarehouseId)) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Quản lý Tồn kho</h2>
            {isAdmin() && (
              <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 shadow-sm">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <select 
                  className="input border-none shadow-none focus:ring-0 py-1.5 text-sm font-medium text-gray-700 w-48"
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                  {warehouses?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Theo dõi số lượng hàng hóa thực tế và khả dụng</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting || filteredInventory.length === 0}
            className="btn-secondary bg-white shadow-sm border-gray-200"
          >
            <Download className="w-4 h-4 mr-2 text-green-600" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>

          <button 
            onClick={() => setShowQuickLookup(true)} 
            className="btn-primary bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-200"
          >
            <Search className="w-4 h-4 mr-2" /> Tra cứu nhanh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng số lượng tồn (Vật lý)</p>
            <p className="text-2xl font-bold text-gray-900">{totalSystemQty.toLocaleString('vi-VN')} SP</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng giá trị vốn (MAC)</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSystemValue)}</p>
          </div>
        </div>
      </div>

      {(lowStockAlerts ?? []).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800">Cảnh báo: Có {lowStockAlerts!.length} sản phẩm sắp hết hàng!</p>
            <p className="text-red-600 text-sm mt-0.5">Vui lòng kiểm tra và lên kế hoạch nhập hàng để tránh làm gián đoạn kinh doanh.</p>
          </div>
        </div>
      )}

      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="input pl-10 py-2.5 w-full bg-white"
            placeholder="Tìm theo tên sản phẩm, mã vạch, SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-56 relative shrink-0">
          <FolderTree className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="input pl-9 w-full bg-white"
          >
            <option value="">Tất cả danh mục</option>
            {categories?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-56 relative shrink-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input pl-9 w-full bg-white"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th>Sản phẩm</th>
                <th>Mã vạch / SKU</th>
                <th className="text-center">Tồn vật lý</th>
                <th className="text-center text-amber-600" title="Hàng khách đã đặt Online nhưng chưa giao">Giữ chỗ</th>
                <th className="text-center text-blue-600" title="Hàng đang trên đường chuyển kho">Đang về</th>
                <th className="text-center text-green-700">Khả dụng (Web)</th>
                <th className="text-center">Trạng thái</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState 
                      icon={Package} 
                      title="Không tìm thấy sản phẩm nào" 
                      description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc" 
                    />
                  </td>
                </tr>
              ) : (
                paginatedInventory.map((inv: any) => (
                  <tr key={inv.id} className={`hover:bg-gray-50 transition-colors ${inv.lowStock ? 'bg-red-50/30' : ''}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
                          {inv.product?.imageUrl ? (
                            <img src={inv.product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm max-w-[250px] truncate" title={inv.product?.name}>
                            {inv.product?.name || 'Sản phẩm không xác định'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="font-mono text-[13px] text-gray-600">{inv.product?.isbnBarcode || '-'}</p>
                      {inv.product?.sku && <p className="text-[11px] text-gray-400 mt-0.5">SKU: {inv.product.sku}</p>}
                    </td>
                    <td className="text-center font-bold text-gray-700 text-base">{inv.quantity}</td>
                    <td className="text-center font-medium text-amber-600">{inv.reservedQuantity > 0 ? inv.reservedQuantity : '-'}</td>
                    <td className="text-center font-medium text-blue-600">{inv.inTransit > 0 ? inv.inTransit : '-'}</td>
                    <td className="text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${
                        inv.availableQuantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {inv.availableQuantity}
                      </span>
                    </td>
                    <td className="text-center">
                      {inv.lowStock ? (
                        <span className="badge bg-red-100 text-red-700 border border-red-200" title={`Định mức an toàn: ${inv.minQuantity}`}>
                          ⚠ Thấp
                        </span>
                      ) : inv.availableQuantity <= 0 ? (
                        <span className="badge bg-gray-200 text-gray-600 border border-gray-300">
                          Hết hàng
                        </span>
                      ) : (
                        <span className="badge bg-green-50 text-green-600 border border-green-200">
                          Đủ hàng
                        </span>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1" title="Định mức báo động (Min Quantity)">Min: {inv.minQuantity}</p>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setSettingMinQty(inv)} 
                          className="btn-ghost btn-sm p-1.5 text-purple-600 hover:bg-purple-50" 
                          title="Cài đặt định mức an toàn"
                        >
                          <BellRing className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => setViewingHistory(inv)} 
                          className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" 
                          title="Xem thẻ kho (Lịch sử biến động)"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => setAdjustingItem(inv)} 
                          className="btn-ghost btn-sm p-1.5 text-amber-600 hover:bg-amber-50" 
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
        
        {totalPages > 1 && (
          <Pagination 
            page={page} 
            totalPages={totalPages} 
            totalElements={filteredInventory.length} 
            size={PAGE_SIZE} 
            onPageChange={setPage} 
          />
        )}
      </div>

      {viewingHistory && (
        <InventoryHistoryModal 
          inventory={viewingHistory} 
          onClose={() => setViewingHistory(null)} 
        />
      )}

      {adjustingItem && (
        <InventoryAdjustModal 
          inventory={adjustingItem} 
          onClose={() => setAdjustingItem(null)} 
        />
      )}

      {settingMinQty && (
        <MinQuantityModal 
          inventory={settingMinQty} 
          onClose={() => setSettingMinQty(null)} 
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['inventory', selectedWarehouseId] });
            qc.invalidateQueries({ queryKey: ['low-stock', selectedWarehouseId] });
          }}
        />
      )}

      {showQuickLookup && (
        <InventoryQuickLookupModal 
          products={productsData || []} 
          selectedWarehouseId={selectedWarehouseId}
          onClose={() => setShowQuickLookup(false)} 
        />
      )}

    </div>
  );
}