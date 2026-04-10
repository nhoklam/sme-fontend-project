import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWebSocket, WsPayload } from './useWebSocket';

interface Options {
  warehouseId: string | undefined | null;
  enabled?: boolean;
}

/**
 * Hook chuyên dụng cho DashboardPage.
 * Nhận WS event → invalidate đúng query cache → React Query tự refetch.
 */
export function useDashboardWebSocket({ warehouseId, enabled = true }: Options) {
  const qc = useQueryClient();

  const handleMessage = useCallback((payload: WsPayload) => {
    switch (payload.type) {

      // ── Tồn kho thấp ────────────────────────────────────────
      case 'LOW_STOCK':
        qc.invalidateQueries({ queryKey: ['low-stock-dashboard'] });
        qc.invalidateQueries({ queryKey: ['report-summary'] });
        toast('⚠️ Cảnh báo tồn kho thấp — danh sách vừa cập nhật', {
          icon: '📦',
          duration: 4000,
          style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
        });
        break;

      // ── Đơn hàng mới ────────────────────────────────────────
      case 'NEW_ORDER': {
        qc.invalidateQueries({ queryKey: ['orders-pending-dashboard'] });
        qc.invalidateQueries({ queryKey: ['top-products-dashboard'] });
        const code = (payload.orderCode as string) ?? 'Mới';
        toast.success(`🛒 Đơn hàng ${code} vừa được tạo`, { duration: 4000 });
        break;
      }

      // ── Ca cần duyệt ─────────────────────────────────────────
      case 'SHIFT_PENDING_APPROVAL':
        qc.invalidateQueries({ queryKey: ['pending-shifts-dashboard'] });
        toast('🕐 Có ca làm việc mới chờ bạn duyệt', {
          icon: '👤',
          duration: 5000,
          style: { background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' },
        });
        break;

      // ── Chuyển kho đến ──────────────────────────────────────
      case 'TRANSFER_ARRIVED':
        qc.invalidateQueries({ queryKey: ['low-stock-dashboard'] });
        toast('📦 Hàng chuyển kho vừa đến nơi', {
          duration: 3000,
          style: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
        });
        break;

      default:
        console.info('[WS] Unknown event type:', payload.type);
    }
  }, [qc]);

  const { isConnected } = useWebSocket({ warehouseId, onMessage: handleMessage, enabled });

  return { isConnected };
}