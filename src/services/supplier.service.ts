import api from '@/lib/axios';
import type { ApiResponse, PageResponse, Supplier } from '@/types'; 

export const supplierService = {
  getAll: (params?: { keyword?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Supplier>>>('/suppliers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Supplier>>(`/suppliers/${id}`),

  create: (data: Partial<Supplier>) =>
    api.post<ApiResponse<Supplier>>('/suppliers', data),

  update: (id: string, data: Partial<Supplier>) =>
    api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data),
    
  importBulk: (data: any[]) =>
    api.post<ApiResponse<any>>('/suppliers/bulk', data),
};