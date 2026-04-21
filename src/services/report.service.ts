// src/services/report.service.ts

import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export const reportService = {
  // Thêm tham số warehouseId cho Summary (Dùng cho các thẻ KPI)
  getSummary: (warehouseId?: string) =>
    api.get<ApiResponse<any>>('/reports/summary', { params: { warehouseId } }),

  // Cập nhật Doanh thu: hỗ trợ cả lọc thời gian và lọc kho
  getRevenue: (params: { from: string; to: string; period?: string; warehouseId?: string }) =>
    api.get<ApiResponse<any[]>>('/reports/revenue', { params }),

  getInventoryValue: (warehouseId?: string) =>
    api.get<ApiResponse<any[]>>('/reports/inventory-value', { params: warehouseId ? { warehouseId } : {} }),

  // Cập nhật Hàng tồn đọng (Dead Stock): truyền object thay vì chỉ truyền number
  getDeadStock: (params: { days?: number; warehouseId?: string }) =>
    api.get<ApiResponse<any[]>>('/reports/dead-stock', { params }),

  // Cập nhật Top sản phẩm
  getTopProducts: (params: { from: string; to: string; limit?: number; warehouseId?: string }) =>
    api.get<ApiResponse<any[]>>('/reports/top-products', { params }),
};