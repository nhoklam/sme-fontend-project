import api from '@/lib/axios';
import type { ApiResponse, PageResponse, InternalTransfer } from '@/types';

export const transferService = {
  getAll: (params?: { page?: number; size?: number; status?: string; keyword?: string }) =>
    api.get<ApiResponse<PageResponse<InternalTransfer>>>('/transfers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<InternalTransfer>>(`/transfers/${id}`),

  create: (data: { fromWarehouseId: string; toWarehouseId: string; items: Array<{ productId: string; quantity: number }>; note?: string }) =>
    api.post<ApiResponse<InternalTransfer>>('/transfers', data),

  // BỔ SUNG HÀM UPDATE NÀY
  update: (id: string, data: { toWarehouseId: string; items: Array<{ productId: string; quantity: number }>; note?: string }) =>
    api.put<ApiResponse<InternalTransfer>>(`/transfers/${id}`, data),

  dispatch: (id: string) =>
    api.post<ApiResponse<InternalTransfer>>(`/transfers/${id}/dispatch`),

  receive: (id: string, items?: Array<{ productId: string; receivedQty: number }>) =>
    api.post<ApiResponse<InternalTransfer>>(`/transfers/${id}/receive`, items ? { items } : undefined),
};