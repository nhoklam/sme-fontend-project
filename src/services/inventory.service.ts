import api from '../lib/axios';

export const inventoryService = {
  getByWarehouse: (wid: string) =>
    api.get(`/inventory/warehouse/${wid}`),

  // ĐÃ SỬA: Bắt lỗi 404 nếu sản phẩm chưa từng có trong kho thì trả về Tồn = 0
  getOne: async (productId: string, wid: string) => {
    try {
      const response = await api.get(`/inventory/${productId}/warehouse/${wid}`);
      return response;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        // Trả về cấu trúc giả (mock) để Modal hiển thị 0 thay vì báo lỗi
        return {
          data: {
            data: {
              productId: productId,
              warehouseId: wid,
              quantity: 0,
              availableQuantity: 0,
              reservedQuantity: 0,
              inTransit: 0,
              minQuantity: 0,
              lowStock: false
            }
          }
        };
      }
      // Nếu là lỗi khác (500, 403...) thì vẫn throw để hiển thị toast báo lỗi
      throw error;
    }
  },

  getLowStock: (wid?: string) =>
    api.get(`/inventory/low-stock${wid ? `?warehouseId=${wid}` : ''}`),

  getTransactions: (inventoryId: string, page: number = 0, size: number = 10) =>
    api.get(`/inventory/${inventoryId}/transactions`, { params: { page, size } }),

  adjust: (data: { productId: string; warehouseId: string; actualQuantity: number; reason: string }) =>
    api.post('/inventory/adjust', data),

  updateMinQuantity: (inventoryId: string, minQuantity: number) =>
    api.put(`/inventory/${inventoryId}/min-quantity`, { minQuantity }),
};