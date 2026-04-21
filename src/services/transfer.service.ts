import api from '@/lib/axios';
import type { ApiResponse, PageResponse, InternalTransfer } from '@/types';

export const transferService = {
  // ĐÃ SỬA: Thêm warehouseId vào params
  getAll: (params?: { page?: number; size?: number; status?: string; keyword?: string; warehouseId?: string }) =>
    api.get<ApiResponse<PageResponse<InternalTransfer>>>('/transfers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<InternalTransfer>>(`/transfers/${id}`),

  create: (data: { fromWarehouseId: string; toWarehouseId: string; items: Array<{ productId: string; quantity: number }>; note?: string }) =>
    api.post<ApiResponse<InternalTransfer>>('/transfers', data),

  update: (id: string, data: { toWarehouseId: string; items: Array<{ productId: string; quantity: number }>; note?: string }) =>
    api.put<ApiResponse<InternalTransfer>>(`/transfers/${id}`, data),

  dispatch: (id: string) =>
    api.post<ApiResponse<InternalTransfer>>(`/transfers/${id}/dispatch`),

  // ĐÃ SỬA: Truyền trực tiếp array items vào body
  receive: (id: string, items: Array<{ productId: string; receivedQty: number }>) =>
    api.post<ApiResponse<InternalTransfer>>(`/transfers/${id}/receive`, items),

  // ĐÃ THÊM: Hàm hủy phiếu
  cancel: (id: string, reason: string = "") =>
    api.post<ApiResponse<InternalTransfer>>(`/transfers/${id}/cancel`, { reason }),
};