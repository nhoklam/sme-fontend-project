import api from '@/lib/axios';
import type { ApiResponse, Warehouse } from '@/types';

export const warehouseService = {
  getAll: () => api.get<ApiResponse<Warehouse[]>>('/warehouses'),

  getById: (id: string) => api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`),

  create: (data: Partial<Warehouse>) =>
    api.post<ApiResponse<Warehouse>>('/warehouses', data),

  update: (id: string, data: Partial<Warehouse>) =>
    api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, data),

  deactivate: (id: string) =>
    api.patch<ApiResponse<Warehouse>>(`/warehouses/${id}/deactivate`),
  activate: (id: string) => api.patch<ApiResponse<any>>(`/warehouses/${id}/activate`), // Thêm dòng này

  
};
