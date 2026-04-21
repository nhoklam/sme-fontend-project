import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Truck, CheckCircle, Plus, Eye, Search, Edit, FileSpreadsheet, Trash2, MapPin } from 'lucide-react';
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
  { value: '', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'DISPATCHED', label: 'Đang vận chuyển' },
  { value: 'RECEIVED', label: 'Đã nhận' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  DISPATCHED: { label: 'Đang vận chuyển', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED: { label: 'Đã nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' },
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
    const brokerURL = import.meta.env.VITE_WS_URL || `${wsProtocol}//${wsHost}:8080/api/ws`;

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
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-indigo-600" /> Điều chuyển kho
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Quản lý quá trình xuất, nhập và luân chuyển hàng hóa giữa các chi nhánh</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting || transferList.length === 0}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none disabled:opacity-50"
          >
            {isExporting ? <Spinner size="sm" /> : <FileSpreadsheet className="w-4 h-4" />}
            Xuất Excel
          </button>
          
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 flex-1 sm:flex-none justify-center"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Tạo phiếu điều chuyển
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
        
        {/* Tìm kiếm & Chi nhánh (Admin) */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative w-full sm:max-w-md shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none font-medium"
              placeholder="Tìm theo mã phiếu..."
              value={keyword}
              onChange={e => {
                setKeyword(e.target.value);
                setPage(0);
              }}
            />
          </div>
          
          {isAdmin() && (
            <div className="relative w-full sm:w-56 shrink-0">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(0); }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block pl-10 p-2.5 transition-colors outline-none cursor-pointer appearance-none"
              >
                <option value="">Tất cả chi nhánh</option>
                {warehouses?.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Lọc Trạng thái dạng Tabs */}
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 xl:pb-0 shrink-0">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(0);
              }}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BẢNG DỮ LIỆU ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col relative min-h-[300px]">
        {isRefetching && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <Spinner size="lg" className="text-indigo-600" />
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Mã phiếu</th>
                <th className="px-5 py-4">Từ kho (Xuất)</th>
                <th className="px-5 py-4">Đến kho (Nhập)</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-right">Tổng giá trị</th>
                <th className="px-5 py-4">Ngày tạo</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transferList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <EmptyState 
                      icon={ArrowLeftRight} 
                      title="Không tìm thấy phiếu chuyển kho nào" 
                      description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc" 
                    />
                  </td>
                </tr>
              ) : (
                transferList.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <button 
                        onClick={() => setViewingTransferId(t.id)} 
                        className="font-mono font-bold text-[13px] text-indigo-600 hover:text-indigo-800 transition-colors block text-left"
                      >
                        {t.code}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        {warehouseMap.get(t.fromWarehouseId) || (
                          <span className="text-[11px] font-mono text-slate-400">{t.fromWarehouseId.slice(0, 8)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        {warehouseMap.get(t.toWarehouseId) || (
                          <span className="text-[11px] font-mono text-slate-400">{t.toWarehouseId.slice(0, 8)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {STATUS_BADGE[t.status] ? (
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${STATUS_BADGE[t.status].className}`}>
                          {STATUS_BADGE[t.status].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                          {t.status}
                        </span>
                      )}
                    </td>
                    
                    <td className="px-5 py-4 text-right font-black text-[15px] tracking-tight text-slate-900">
                      {formatCurrency(calculateTotalValue(t.items))}
                    </td>

                    <td className="px-5 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(t.createdAt)}
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-90 group-hover:opacity-100 transition-opacity">
                        
                        {/* Nút Xuất Kho (Dành cho phiếu nháp) */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setConfirmDispatch(t.id)}
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 shadow-sm shrink-0"
                            title="Xác nhận Xuất kho"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" /> Xuất kho
                          </button>
                        )}

                        {/* Nút Nhận Hàng (Dành cho phiếu đang vận chuyển) */}
                        {t.status === 'DISPATCHED' && (isAdmin() || user?.warehouseId === t.toWarehouseId) && (
                          <button
                            onClick={() => setReceivingTransferId(t.id)}
                            className="h-8 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 shadow-sm shrink-0"
                            title="Xác nhận Nhận hàng"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Nhận hàng
                          </button>
                        )}
                        
                        {/* Nút Sửa Phiếu */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setEditingTransferId(t.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 transition-colors shrink-0"
                            title="Chỉnh sửa phiếu"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Hủy phiếu */}
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => handleCancelTransfer(t.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition-colors shrink-0"
                            title="Hủy phiếu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Nút Xem chi tiết */}
                        <button
                          onClick={() => setViewingTransferId(t.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0"
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
    </div>
  );
}