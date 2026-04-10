import api from '@/lib/axios';
import type { ApiResponse, PageResponse, PurchaseOrder, CreatePurchaseOrderRequest } from '@/types';

export const purchaseService = {
  getAll: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<PurchaseOrder>>>('/purchase-orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`),

  // ĐÃ BỔ SUNG: Lấy lịch sử nhập kho của 1 NCC cụ thể (Có phân trang)
  getBySupplier: (supplierId: string, params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<PurchaseOrder>>>(`/purchase-orders/supplier/${supplierId}`, { params }),

  create: (data: CreatePurchaseOrderRequest) =>
    api.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data),

  approve: (id: string) =>
    api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/approve`),

  cancel: (id: string, reason?: string) =>
    api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/cancel`, { reason }),
};