
import api from '@/lib/axios';
import type { ApiResponse, PageResponse, OrderResponse, CreateOrderRequest } from '@/types';

export const orderService = {
  getOrders: (params?: { status?: string; type?: string; keyword?: string; page?: number; size?: number; warehouseId?: string }) =>
    api.get<ApiResponse<PageResponse<OrderResponse>>>('/orders', { params }),

  getPending: (warehouseId?: string) =>
    api.get<ApiResponse<OrderResponse[]>>('/orders/pending', {
      params: warehouseId ? { warehouseId } : undefined
    }),

  getById: (id: string) =>
    api.get<ApiResponse<OrderResponse>>(`/orders/${id}`),

  create: (data: CreateOrderRequest) =>
    api.post<ApiResponse<OrderResponse>>('/orders', data),

  // ĐÃ THÊM: API Gợi ý kho (Order Routing)
  suggestBranch: (data: { provinceCode: string; items: Array<{ productId: string; quantity: number }> }) =>
    api.post<ApiResponse<any[]>>('/orders/suggest-branch', data),

  // =====================================================================
  // ĐÃ THAY THẾ updateStatus() bằng 8 method riêng - khớp với 8 endpoint mới
  // ở backend. Mỗi action gọi đúng 1 URL, không còn truyền "status" tự do.
  // =====================================================================

  /** MANAGER only: PENDING -> CONFIRMED */
  confirm: (id: string, note?: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/confirm`, { note }),

  /** CASHIER hoặc MANAGER: CONFIRMED -> PACKED */
  pack: (id: string, note?: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/pack`, { note }),

  /** MANAGER only, type=DELIVERY: PACKED -> SHIPPING */
  ship: (id: string, body: { trackingCode?: string; shippingProvider?: string; note?: string }) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/ship`, body),

  /** MANAGER only, type=BOPIS: PACKED -> READY_FOR_PICKUP */
  markReady: (id: string, note?: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/mark-ready`, { note }),

  /** MANAGER only: SHIPPING/READY_FOR_PICKUP -> DELIVERED */
  complete: (id: string, note?: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/complete`, { note }),

  /** MANAGER only: DELIVERED -> RETURNED */
  returnOrder: (id: string, reason: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/return`, { reason }),

  /** CASHIER (chỉ PENDING) hoặc MANAGER (đến PACKED) */
  cancel: (id: string, reason: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/cancel`, { reason }),

  /** ADMIN only - lý do bắt buộc tối thiểu 20 ký tự */
  forceCancel: (id: string, reason: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/force-cancel`, { reason }),

  /** ADMIN only - chỉ khi đơn còn PENDING/WAITING_FOR_CONSOLIDATION */
  reassign: (id: string, warehouseId: string) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/reassign`, { warehouseId }),
};
