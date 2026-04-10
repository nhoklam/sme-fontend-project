import api from '@/lib/axios';
import type { ApiResponse, PageResponse, ProductResponse, CreateProductRequest, UpdateProductRequest } from '@/types';

export const productService = {
  // ĐÃ CẬP NHẬT: Xóa bỏ isActive khỏi tham số params để khớp chính xác với Backend
  getProducts: (params?: { keyword?: string; categoryId?: string; isActive?: boolean; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<ProductResponse>>>('/products', { params }),

  getByBarcode: (code: string) =>
    api.get<ApiResponse<ProductResponse>>(`/products/barcode/${code}`),

  getById: (id: string) =>
    api.get<ApiResponse<ProductResponse>>(`/products/${id}`),

  create: (data: CreateProductRequest) =>
    api.post<ApiResponse<ProductResponse>>('/products', data),

  update: (id: string, data: UpdateProductRequest) =>
    api.put<ApiResponse<ProductResponse>>(`/products/${id}`, data),
};