import api from '../lib/axios';
import type { ApiResponse, PageResponse } from '@/types';

export interface InventoryResponse {
  id: string | null;
  productId: string;
  productName: string;
  productSku: string;
  isbnBarcode: string;
  productImageUrl: string;
  categoryName: string;
  quantity: number;
  reservedQuantity: number;
  inTransit: number;
  minQuantity: number;
  lowStock: boolean;
  availableQuantity: number;
}

export const inventoryService = {
  searchInventory: (warehouseId: string, params: { keyword?: string; categoryId?: string; status?: string; page: number; size: number }) =>
    api.get<ApiResponse<PageResponse<InventoryResponse>>>(`/inventory/warehouse/${warehouseId}/search`, { params }),

  getOne: (productId: string, wid: string) =>
    api.get<ApiResponse<InventoryResponse>>(`/inventory/${productId}/warehouse/${wid}`),

  getLowStock: (wid?: string) =>
    api.get(`/inventory/low-stock${wid ? `?warehouseId=${wid}` : ''}`),

  getTransactions: (inventoryId: string, page: number = 0, size: number = 10) =>
    api.get(`/inventory/${inventoryId}/transactions`, { params: { page, size } }),

  adjust: (data: { productId: string; warehouseId: string; actualQuantity: number; reason: string }) =>
    api.post('/inventory/adjust', data),

  // KHÔI PHỤC LẠI NGUYÊN BẢN
  updateMinQuantity: (inventoryId: string, minQuantity: number) =>
    api.put(`/inventory/${inventoryId}/min-quantity`, { minQuantity }),
};