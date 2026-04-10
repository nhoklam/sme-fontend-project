import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Truck, CheckCircle, Plus, Eye, Search, Edit, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { transferService } from '@/services/transfer.service';
import { warehouseService } from '@/services/warehouse.service';
import { productService } from '@/services/product.service'; 
import { formatDateTime } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, ConfirmDialog, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/stores/auth.store';

// Import các Modals
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

export default function TransfersPage() {
  const { user, isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [confirmDispatch, setConfirmDispatch] = useState<string | null>(null);
  const [receivingTransferId, setReceivingTransferId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingTransferId, setViewingTransferId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Dùng useRef để giữ Client, tránh bị khởi tạo lại nhiều lần làm rò rỉ bộ nhớ (Memory Leak)
  const stompClientRef = useRef<Client | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // TỐI ƯU HIỆU NĂNG: Xóa refetchInterval (Polling), chỉ dùng refetchOnWindowFocus
  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, statusFilter, debouncedKeyword],
    queryFn: async () => {
      try {
        const response = await transferService.getAll({
          page,
          size: 20,
          status: statusFilter || undefined,
          keyword: debouncedKeyword || undefined
        });
        return response?.data?.data || { content: [], totalPages: 0, totalElements: 0 };
      } catch (error) {
        return { content: [], totalPages: 0, totalElements: 0 };
      }
    },
    refetchOnWindowFocus: true, 
    // ✅ ĐÃ SỬA: Tắt staleTime để luôn lấy dữ liệu mới nhất khi có WebSocket trigger
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
    warehouses?.forEach(w => map.set(w.id, w.name));
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

  // =====================================================================
  // ĐÃ FIX: CHỈNH ĐÚNG URL WEBSOCKET VÀ BẬT REFECTH ÉP TẢI LẠI
  // =====================================================================
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user?.warehouseId) return;

    if (stompClientRef.current && stompClientRef.current.active) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    
    // ✅ ĐÃ SỬA: Lấy linh động từ biến môi trường, fallback về port 8080 khi chạy dev local
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
        
        // ✅ ĐÃ SỬA LỖI ĐƯỜNG DẪN TOPIC:
        const topic = `/topic/warehouse/${user.warehouseId}/transfer`;
        
        client.subscribe(topic, (message) => {
          console.log('🔔 [STOMP] CÓ BIẾN ĐỘNG TỪ SERVER:', message.body);
          toast.success('📦 Có biến động từ kho đối tác!', { icon: '🔔' });
          
          // Dùng refetchQueries thay vì invalidateQueries để ép tải lại lập tức
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

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    DISPATCHED: 'bg-amber-100 text-amber-700',
    RECEIVED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

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
        keyword: debouncedKeyword || undefined
      });
      
      const allTransfers = response?.data?.data?.content || [];
      if (allTransfers.length === 0) {
        toast.error('Không có dữ liệu để xuất Excel');
        return;
      }

      const excelData = allTransfers.map((t: any, index: number) => {
        const fromWarehouseName = warehouseMap.get(t.fromWarehouseId) || t.fromWarehouseId;
        const toWarehouseName = warehouseMap.get(t.toWarehouseId) || t.toWarehouseId;
        const statusLabel = STATUS_OPTIONS.find(opt => opt.value === t.status)?.label || t.status;
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Điều chuyển kho nội bộ</h2>
          <p className="text-sm text-gray-500">Quản lý quá trình chuyển hàng hóa giữa các chi nhánh</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting || transferList.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            {isExporting ? <Spinner size="sm" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
            Xuất Excel
          </button>
          
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tạo phiếu
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Tìm theo mã phiếu..."
            value={keyword}
            onChange={e => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Từ kho (Xuất)</th>
                <th>Đến kho (Nhập)</th>
                <th>Trạng thái</th>
                <th className="text-right">Tổng giá trị</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {transferList.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={ArrowLeftRight} title="Không tìm thấy phiếu chuyển kho nào" />
                  </td>
                </tr>
              ) : (
                transferList.map((t: any) => (
                  <tr key={t.id}>
                    <td className="font-mono font-semibold text-primary-600">{t.code}</td>
                    <td className="font-medium text-gray-700">
                      {warehouseMap.get(t.fromWarehouseId) || (
                        <span className="text-xs font-mono text-gray-400">{t.fromWarehouseId.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td className="font-medium text-gray-700">
                      {warehouseMap.get(t.toWarehouseId) || (
                        <span className="text-xs font-mono text-gray-400">{t.toWarehouseId.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusColors[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.status}
                      </span>
                    </td>
                    
                    <td className="text-right font-semibold text-gray-800">
                      {formatCurrency(calculateTotalValue(t.items))}
                    </td>

                    <td className="text-gray-500 text-xs">{formatDateTime(t.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingTransferId(t.id)}
                          className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setEditingTransferId(t.id)}
                            className="btn-ghost btn-sm p-1.5 text-amber-600 hover:bg-amber-50 ml-1"
                            title="Chỉnh sửa phiếu"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        
                        {t.status === 'DRAFT' && (isAdmin() || user?.warehouseId === t.fromWarehouseId) && (
                          <button
                            onClick={() => setConfirmDispatch(t.id)}
                            className="btn-primary btn-sm text-xs ml-1"
                          >
                            <Truck className="w-3.5 h-3.5 mr-1" /> Xuất kho
                          </button>
                        )}
                        
                        {t.status === 'DISPATCHED' && (isAdmin() || user?.warehouseId === t.toWarehouseId) && (
                          <button
                            onClick={() => setReceivingTransferId(t.id)}
                            className="btn-success btn-sm text-xs ml-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Nhận hàng
                          </button>
                        )}
                        
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
            totalElements={totalElements}
            size={20}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDispatch}
        title="Xuất kho"
        description="Xác nhận xuất hàng? Tồn kho nguồn sẽ bị trừ ngay."
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