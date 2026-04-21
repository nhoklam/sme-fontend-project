import api from '@/lib/axios';
import type { ApiResponse, PageResponse, Customer } from '@/types';

export const customerService = {
  lookup: (phone: string) =>
    api.get<ApiResponse<Customer>>('/customers/lookup', { params: { phone } }),

  getAll: (params?: { keyword?: string; tier?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Customer>>>('/customers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/customers/${id}`),

  create: (data: Partial<Customer>) =>
    api.post<ApiResponse<Customer>>('/customers', data),

  update: (id: string, data: Partial<Customer>) =>
    api.put<ApiResponse<Customer>>(`/customers/${id}`, data),

  getTopSpenders: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Customer>>>('/customers/top', { params }),
  
  getHistory: (id: string, params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<{ invoices: any[]; orders: any[] }>>(`/customers/${id}/history`, { params }),

  // === THÊM HÀM IMPORT BULK ===
  importBulk: (data: any[]) =>
    api.post<ApiResponse<any>>('/customers/bulk', data),
};