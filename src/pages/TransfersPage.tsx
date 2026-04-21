import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Truck, CheckCircle, Plus, Eye, Search, Edit, FileSpreadsheet, Trash2, MapPin, ChevronDown, DollarSign } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { transferService } from '@/services/transfer.service';
import { warehouseService } from '@/services/warehouse.service';
import { productService } from '@/services/product.service'; 
import { formatDateTime } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, ConfirmDialog, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/stores/auth.store';

import { CreateTransferModal } from './CreateTransferModal';
import { TransferDetailsModal } from './TransferDetailsModal';
import { ReceiveTransferModal } from './ReceiveTransferModal';
import { EditTransferModal } from './EditTransferModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'DISPATCHED', label: 'Đang vận chuyển' },
  { value: 'RECEIVED', label: 'Đã nhận' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  DISPATCHED: { label: 'Đang vận chuyển', className: 'bg-amber-50 text-amber-700 border-amber-200/60' },
  RECEIVED: { label: 'Đã nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200/60' },
};

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
          <span className="text-sm font-black text-slate-900">{payload[0].value} phiếu</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function TransfersPage() {
  const { user, isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // State bộ lọc chi nhánh cho Admin
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  const [confirmDispatch, setConfirmDispatch] = useState<string | null>(null);
  const [receivingTransferId, setReceivingTransferId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingTransferId, setViewingTransferId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const stompClientRef = useRef<Client | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['transfers', page, statusFilter, debouncedKeyword, selectedWarehouseId],
    queryFn: async () => {
      try {
        const response = await transferService.getAll({
          page,
          size: 20,
          status: statusFilter || undefined,
          keyword: debouncedKeyword || undefined,
          warehouseId: isAdmin() ? (selectedWarehouseId || undefined) : user?.warehouseId
        });
        return response?.data?.data || { content: [], totalPages: 0, totalElements: 0 };
      } catch (error) {
        return { content: [], totalPages: 0, totalElements: 0 };
      }
    },
    refetchOnWindowFocus: true, 
    staleTime: 0, 
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    staleTime: 5 * 60 * 1000, 
  });

  const { data: products } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
    staleTime: 5 * 60 * 1000, 
  });

  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouses?.forEach((w: any) => map.set(w.id, w.name));
    return map;
  }, [warehouses]);

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products?.forEach((p: any) => map.set(p.id, p));
    return map;
  }, [products]);

  const dispatchMut = useMutation({
    mutationFn: (id: string) => transferService.dispatch(id),
    onSuccess: async (_, id) => {
      toast.success('Đã xuất kho, hàng đang vận chuyển');
      await qc.refetchQueries({ queryKey: ['transfers'] });
      await qc.refetchQueries({ queryKey: ['transfer-detail', id] }); 
      setConfirmDispatch(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi xuất kho'),
  });

  // Mutation Hủy phiếu chuyển kho
  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => transferService.cancel(id, reason),
    onSuccess: async () => {
      toast.success('Đã hủy phiếu chuyển kho');
      await qc.refetchQueries({ queryKey: ['transfers'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi hủy phiếu'),
  });

  const handleCancelTransfer = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn hủy phiếu chuyển kho này không?")) {
      cancelMut.mutate({ id, reason: "" }); 
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user?.warehouseId) return;

    if (stompClientRef.current && stompClientRef.current.active) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const brokerURL = (import.meta as any).env.VITE_WS_URL || `${wsProtocol}//${wsHost}:8080/api/ws`;

    const client = new Client({
      brokerURL: brokerURL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000, 
      
      debug: (str) => {
        console.log('🔍 [STOMP DEBUG]:', str); 
      },

      onConnect: () => {
        console.log('✅ [STOMP] KẾT NỐI THÀNH CÔNG CHO KHO:', user.warehouseId);
        const topic = `/topic/warehouse/${user.warehouseId}/transfer`;
        
        client.subscribe(topic, (message) => {
          console.log('🔔 [STOMP] CÓ BIẾN ĐỘNG TỪ SERVER:', message.body);
          toast.success('📦 Có biến động từ kho đối tác!', { icon: '🔔' });
          qc.refetchQueries({ queryKey: ['transfers'] });
        });
      },
      
      onStompError: (frame) => {
        console.error('❌ [STOMP ERROR] Lỗi Broker:', frame.headers['message']);
      },
      onWebSocketError: (event) => {
        console.error('❌ [WS ERROR] Mất kết nối WebSocket. Kiểm tra lại Backend!');
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
  }, [user?.warehouseId, qc]);

  const transferList = Array.isArray(data) ? data : (data?.content ?? []);
  const totalPages = data?.totalPages ?? 1;
  const totalElements = data?.totalElements ?? transferList.length;

  const calculateTotalValue = (items: any[]) => {
    if (!items || !Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      const price = product?.macPrice || product?.retailPrice || 0;
      return sum + (item.quantity * price);
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // --- TÍNH TOÁN DATA CHO MINI DASHBOARD ---
  const dashboardStats = useMemo(() => {
    let totalValue = 0;
    const statusCount: Record<string, { count: number, color: string }> = {};

    transferList.forEach((t: any) => {
      totalValue += calculateTotalValue(t.items);
      const statusLabel = STATUS_BADGE[t.status]?.label || t.status;
      
      if (!statusCount[statusLabel]) {
        let color = '#94a3b8'; // DRAFT
        if (t.status === 'DISPATCHED') color = '#f59e0b'; // Amber
        if (t.status === 'RECEIVED') color = '#10b981'; // Emerald
        if (t.status === 'CANCELLED') color = '#f43f5e'; // Rose
        statusCount[statusLabel] = { count: 0, color };
      }
      statusCount[statusLabel].count++;
    });

    const chartData = Object.entries(statusCount).map(([name, val]) => ({
      name, value: val.count, color: val.color
    }));

    return { totalValue, chartData };
  }, [transferList, productMap]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const response = await transferService.getAll({
        page: 0,
        size: 10000, 
        status: statusFilter || undefined,
        keyword: debouncedKeyword || undefined,
        warehouseId: isAdmin() ? (selectedWarehouseId || undefined) : user?.warehouseId
      });
      
      const allTransfers = response?.data?.data?.content || [];
      if (allTransfers.length === 0) {
        toast.error('Không có dữ liệu để xuất Excel');
        return;
      }

      const excelData = allTransfers.map((t: any, index: number) => {
        const fromWarehouseName = warehouseMap.get(t.fromWarehouseId) || t.fromWarehouseId;
        const toWarehouseName = warehouseMap.get(t.toWarehouseId) || t.toWarehouseId;
        const statusLabel = STATUS_BADGE[t.status]?.label || t.status;
        const totalValue = calculateTotalValue(t.items);

        return {
          'STT': index + 1,
          'Mã Phiếu': t.code,
          'Từ Kho (Xuất)': fromWarehouseName,
          'Đến Kho (Nhập)': toWarehouseName,
          'Trạng Thái': statusLabel,
          'Tổng Giá Trị (VNĐ)': totalValue,
          'Ngày Tạo': formatDateTime(t.createdAt),
          'Ghi Chú': t.note || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachPhieuChuyen");

      worksheet['!cols'] = [
        { wch: 5 },  { wch: 20 }, { wch: 25 }, { wch: 25 }, 
        { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }
      ];

      XLSX.writeFile(workbook, `Bao_Cao_Chuyen_Kho_${new Date().getTime()}.xlsx`);
      toast.success('Xuất file Excel thành công!');
    } catch (error) {
      console.error("Lỗi xuất Excel:", error);
      toast.error('Có lỗi xảy ra khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && page === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Điều chuyển kho</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Quản lý quá trình xuất, nhập và luân chuyển hàng hóa giữa các chi nhánh.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting || transferList.length === 0}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 flex-1 md:flex-none"
          >
            {isExporting ? <Spinner size="sm" /> : <FileSpreadsheet className="w-4 h-4" />}
            Xuất Excel
          </button>
          
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all flex-1 md:flex-none"
          >
            <Plus className="w-5 h-5" /> Tạo phiếu luân chuyển
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
              <ArrowLeftRight className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng phiếu trang này</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{transferList.length} <span className="text-sm font-bold text-slate-400">/ {totalElements}</span></h3>
            </div>
          </div>
          <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center mt-2">
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/> Giá trị luân chuyển</span>
             <span className="font-black text-indigo-600 text-base">{formatCurrency(dashboardStats.totalValue)}</span>
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
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu trạng thái (Trang này)</p>
            <div className="space-y-3">
              {dashboardStats.chartData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{d.value} <span className="text-xs font-medium text-slate-400 ml-1">phiếu</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC BẢNG DỮ LIỆU & BỘ LỌC ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm theo mã phiếu..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={keyword}
                onChange={e => {
                  setKeyword(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            
            {isAdmin() && (
              <div className="relative w-full sm:w-56 shrink-0 group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(0); }}
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">Tất cả chi nhánh</option>
                  {warehouses?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            )}

            <div className="relative w-full sm:w-48 shrink-0 group">
               <ArrowLeftRight className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={statusFilter} 
                 onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
               >
                 {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {isRefetching && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner size="lg" className="text-indigo-600" />
            </div>
          )}

          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Mã phiếu</th>
                <th className="px-6 py-5">Từ kho (Xuất)</th>
                <th className="px-6 py-5">Đến kho (Nhập)</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right">Tổng giá trị</th>
                <th className="px-6 py-5">Ngày tạo</th>
                <th className="px-6 py-5 text-right w-44">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {transferList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24">
                    <EmptyState 
                      icon={ArrowLeftRight} 
                      title="Chưa có phiếu chuyển kho nào" 
                      description="Không có dữ liệu phù hợp với bộ lọc tìm kiếm của bạn." 
                    />
                  </td>
                </tr>
              ) : (
                transferList.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setViewingTransferId(t.id)} 
                        className="font-mono font-bold text-[14px] text-indigo-600 hover:text-indigo-800 transition-colors block text-left"
                      >
                        {t.code}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                        {warehouseMap.get(t.fromWarehouseId) || (
                          <span className="text-[11px] font-mono text-slate-400">{t.fromWarehouseId.slice(0, 8)}...</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                        {warehouseMap.get(t.toWarehouseId) || (
                          <span className="text-[11px] font-mono text-slate-400">{t.toWarehouseId.slice(0, 8)}...</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {STATUS_BADGE[t.status] ? (
                        <span className={`inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${STATUS_BADGE[t.status].className}`}>
                          {STATUS_BADGE[t.status].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {t.status}
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-right font-black text-base tracking-tight text-slate-900">
                      {formatCurrency(calculateTotalValue(t.items))}
                    </td>

                    <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(t.createdAt)}
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        
                        {/* Nút Xuất Kho (Dành cho phiếu nháp) */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setConfirmDispatch(t.id)}
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-indigo-700 bg-indigo-50 border border-indigo-100/60 hover:bg-indigo-100 shadow-sm shrink-0"
                            title="Xác nhận Xuất kho"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" /> Xuất kho
                          </button>
                        )}

                        {/* Nút Nhận Hàng (Dành cho phiếu đang vận chuyển) */}
                        {t.status === 'DISPATCHED' && (isAdmin() || user?.warehouseId === t.toWarehouseId) && (
                          <button
                            onClick={() => setReceivingTransferId(t.id)}
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-emerald-700 bg-emerald-50 border border-emerald-100/60 hover:bg-emerald-100 shadow-sm shrink-0"
                            title="Xác nhận Nhận hàng"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Nhận hàng
                          </button>
                        )}
                        
                        {/* Nút Sửa Phiếu */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setEditingTransferId(t.id)}
                            className="p-1.5 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                            title="Chỉnh sửa phiếu"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Hủy phiếu */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => handleCancelTransfer(t.id)}
                            className="p-1.5 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                            title="Hủy phiếu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Xem chi tiết */}
                        <button
                          onClick={() => setViewingTransferId(t.id)}
                          className="p-1.5 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
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
        {totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              size={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ── DIALOGS & MODALS ── */}
      <ConfirmDialog
        open={!!confirmDispatch}
        title="Xác nhận Xuất kho"
        description="Bạn có chắc chắn xuất số hàng này không? Tồn kho tại chi nhánh nguồn sẽ bị trừ ngay lập tức và trạng thái phiếu sẽ chuyển sang Đang vận chuyển."
        onConfirm={() => dispatchMut.mutate(confirmDispatch!)}
        onCancel={() => setConfirmDispatch(null)}
        loading={dispatchMut.isPending}
      />

      {showCreateModal && (
        <CreateTransferModal
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            await qc.refetchQueries({ queryKey: ['transfers'] });
            setShowCreateModal(false);
          }}
        />
      )}

      {viewingTransferId && (
        <TransferDetailsModal
          transferId={viewingTransferId}
          onClose={() => setViewingTransferId(null)}
        />
      )}

      {editingTransferId && (
        <EditTransferModal
          transferId={editingTransferId}
          onClose={() => setEditingTransferId(null)}
          onSaved={() => setEditingTransferId(null)}
        />
      )}

      {receivingTransferId && (
        <ReceiveTransferModal
          transferId={receivingTransferId}
          onClose={() => setReceivingTransferId(null)}
          onSaved={async () => {
            await qc.refetchQueries({ queryKey: ['transfers'] });
            await qc.refetchQueries({ queryKey: ['transfer-detail', receivingTransferId] }); 
            setReceivingTransferId(null);
          }}
        />
      )}
      
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