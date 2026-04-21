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

  updateStatus: (id: string, body: { status: string; note?: string; trackingCode?: string; shippingProvider?: string }) =>
    api.patch<ApiResponse<OrderResponse>>(`/orders/${id}/status`, body),
    
  // ĐÃ THÊM: API Gợi ý kho (Order Routing)
  suggestBranch: (data: { provinceCode: string; items: Array<{ productId: string; quantity: number }> }) =>
    api.post<ApiResponse<any[]>>('/orders/suggest-branch', data),
};