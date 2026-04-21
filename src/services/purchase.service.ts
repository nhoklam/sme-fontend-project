import api from '@/lib/axios';
import type { ApiResponse, PageResponse, PurchaseOrder, CreatePurchaseOrderRequest } from '@/types';

export const purchaseService = {
  // ĐÃ SỬA: Thêm keyword, status
  getAll: (params?: { keyword?: string; status?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<PurchaseOrder>>>('/purchase-orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`),

  getBySupplier: (supplierId: string, params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<PurchaseOrder>>>(`/purchase-orders/supplier/${supplierId}`, { params }),

  create: (data: CreatePurchaseOrderRequest) =>
    api.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data),

  approve: (id: string) =>
    api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/approve`),

  cancel: (id: string, reason?: string) =>
    api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/cancel`, { reason }),
};