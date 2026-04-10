import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export const reportService = {
  getSummary: () =>
    api.get<ApiResponse<Record<string, any>>>('/reports/summary'),

  getRevenue: (params: { from: string; to: string; period?: string }) =>
    api.get<ApiResponse<any[]>>('/reports/revenue', { params }),

  getInventoryValue: (warehouseId?: string) =>
    api.get<ApiResponse<any[]>>('/reports/inventory-value', { params: warehouseId ? { warehouseId } : {} }),

  getDeadStock: (days = 90) =>
    api.get<ApiResponse<any[]>>('/reports/dead-stock', { params: { days } }),

  getTopProducts: (params: { from: string; to: string; limit?: number }) =>
    api.get<ApiResponse<any[]>>('/reports/top-products', { params }),
};
