import api from '@/lib/axios';
import type { ApiResponse, PageResponse, Supplier } from '@/types'; // ĐÃ BỔ SUNG PageResponse

export const supplierService = {
  // ĐÃ NÂNG CẤP: Hỗ trợ phân trang và tìm kiếm Server-side
  getAll: (params?: { keyword?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Supplier>>>('/suppliers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Supplier>>(`/suppliers/${id}`),

  create: (data: Partial<Supplier>) =>
    api.post<ApiResponse<Supplier>>('/suppliers', data),

  update: (id: string, data: Partial<Supplier>) =>
    api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data),
};