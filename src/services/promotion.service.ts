import api from '../lib/axios';
import type { ApiResponse, PageResponse } from '@/types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface PromotionResponse {
  id: string;
  code: string;
  name: string;
  type: 'PERCENT' | 'FIXED_AMOUNT';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  applicableTo: 'ALL' | 'POS' | 'ONLINE';
  isActive: boolean;
  createdAt: string;
  // Computed từ backend
  isExpired: boolean;
  isValid: boolean;
  remainingUses: number; // -1 = không giới hạn
  // Chỉ có khi validate
  discountAmount?: number;
}

export interface CreatePromotionRequest {
  code: string;
  name: string;
  type: 'PERCENT' | 'FIXED_AMOUNT';
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate: string;  // ISO string
  endDate: string;
  applicableTo?: 'ALL' | 'POS' | 'ONLINE';
}

export interface UpdatePromotionRequest {
  name?: string;
  value?: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  applicableTo?: 'ALL' | 'POS' | 'ONLINE';
  isActive?: boolean;
}

export interface ValidateCodeRequest {
  code: string;
  orderTotal: number;
  channel: 'POS' | 'ONLINE';
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────
export const promotionService = {
  /** Danh sách tất cả (Manager/Admin, phân trang) */
  getAll: (params?: { keyword?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<PromotionResponse>>>('/promotions', { params }),

  /** Chi tiết một khuyến mãi */
  getById: (id: string) =>
    api.get<ApiResponse<PromotionResponse>>(`/promotions/${id}`),

  /** Danh sách đang hoạt động — cho POS dropdown (Cashier cũng gọi được) */
  getActive: () =>
    api.get<ApiResponse<PromotionResponse[]>>('/promotions/active'),

  /**
   * Validate mã và xem trước số tiền giảm — KHÔNG tăng usedCount.
   * Dùng khi Cashier nhập mã → hiện preview trước khi bấm Thanh toán.
   */
  validateCode: (data: ValidateCodeRequest) =>
    api.post<ApiResponse<PromotionResponse>>('/promotions/validate', data),

  /** Tạo mới (Admin only) */
  create: (data: CreatePromotionRequest) =>
    api.post<ApiResponse<PromotionResponse>>('/promotions', data),

  /** Cập nhật (Admin only) */
  update: (id: string, data: UpdatePromotionRequest) =>
    api.put<ApiResponse<PromotionResponse>>(`/promotions/${id}`, data),

  /** Tắt mã (Admin only) */
  deactivate: (id: string) =>
    api.patch<ApiResponse<void>>(`/promotions/${id}/deactivate`),
};
