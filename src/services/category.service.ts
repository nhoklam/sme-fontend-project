import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

// Định nghĩa Type chuẩn khớp với Backend
export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

// Payload khi Gửi lên Backend (Create/Update)
export interface CategoryPayload {
  name: string;
  parentId?: string | null;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const categoryService = {
  getAll: () => 
    api.get<ApiResponse<Category[]>>('/categories'),

  create: (data: CategoryPayload) =>
    api.post<ApiResponse<Category>>('/categories', data),

  update: (id: string, data: CategoryPayload) =>
    api.put<ApiResponse<Category>>(`/categories/${id}`, data),
};