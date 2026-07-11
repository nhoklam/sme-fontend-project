import api from '../lib/axios';
import type { ApiResponse, PageResponse } from '@/types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface StockTakeItemResponse {
  id: string;
  productId: string;
  productName: string;
  isbnBarcode?: string;
  systemQuantity: number;
  actualQuantity: number | null;
  discrepancy: number | null;
}

export interface StockTakeResponse {
  id: string;
  code: string;
  warehouseId: string;
  warehouseName?: string;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED';
  note?: string;
  createdAt: string;
  completedAt?: string;
  totalItems: number;
  discrepancyItems: number;
  hasDiscrepancy?: boolean;
  items: StockTakeItemResponse[];
}

export interface CreateStockTakeRequest {
  warehouseId?: string;
  productIds?: string[];
  note?: string;
}

export interface ItemCountRequest {
  productId: string;
  actualQuantity: number;
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────
export const stockTakeService = {
  /** Lấy danh sách phiếu kiểm kê (phân trang) */
  getAll: (params: { warehouseId?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<StockTakeResponse>>>('/stock-takes', { params }),

  /** Chi tiết một phiếu (có đầy đủ items) */
  getById: (id: string) =>
    api.get<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}`),

  /** Tạo phiếu mới (DRAFT) */
  create: (data: CreateStockTakeRequest) =>
    api.post<ApiResponse<StockTakeResponse>>('/stock-takes', data),

  /** Thêm sản phẩm vào phiếu DRAFT */
  addProducts: (id: string, productIds: string[]) =>
    api.post<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/products`, { productIds }),

  /** Xóa sản phẩm khỏi phiếu DRAFT */
  removeProduct: (id: string, productId: string) =>
    api.delete<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/products/${productId}`),

  /** Bắt đầu đếm: DRAFT → IN_PROGRESS */
  start: (id: string) =>
    api.post<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/start`),

  /** Nhập số lượng thực tế cho nhiều sản phẩm một lần */
  updateCount: (id: string, counts: ItemCountRequest[]) =>
    api.patch<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/count`, counts),

  /** Hoàn thành: IN_PROGRESS → COMPLETED */
  complete: (id: string) =>
    api.post<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/complete`),

  /** Duyệt & áp dụng điều chỉnh kho: COMPLETED → APPROVED */
  approve: (id: string, note?: string) =>
    api.post<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/approve`, { note }),

  /** Hủy phiếu (không ảnh hưởng tồn kho) */
  cancel: (id: string, reason: string) =>
    api.post<ApiResponse<StockTakeResponse>>(`/stock-takes/${id}/cancel`, { reason }),
};
