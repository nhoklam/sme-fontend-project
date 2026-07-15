import api from '@/lib/axios';
import type { 
  ApiResponse, 
  CashbookTransaction, 
  CreateCashbookEntryRequest, 
  SupplierDebt, 
  PaySupplierDebtRequest, 
  CodReconciliationResult,
  PageResponse,     // Đã thêm
  OrderResponse     // Đã thêm
} from '@/types';

export const financeService = {
  getCashbookBalance: (warehouseId?: string) =>
    api.get<ApiResponse<Record<string, number>>>('/finance/cashbook/balance', { 
        params: warehouseId ? { warehouseId } : {} 
    }),

  getCashbook: (warehouseId: string | undefined, from: string, to: string) =>
    api.get<ApiResponse<CashbookTransaction[]>>('/finance/cashbook', { 
        params: { ...(warehouseId ? { warehouseId } : {}), from, to } 
    }),

  createCashbookEntry: (data: CreateCashbookEntryRequest) =>
    api.post<ApiResponse<CashbookTransaction>>('/finance/cashbook', data),

  getSupplierDebts: () =>
    api.get<ApiResponse<SupplierDebt[]>>('/finance/supplier-debts'),

  getOutstandingDebts: (warehouseId?: string) =>
    api.get<ApiResponse<SupplierDebt[]>>('/finance/supplier-debts', {
      params: warehouseId ? { warehouseId } : {}
    }),

  getTotalOutstandingBySupplier: (supplierId: string, warehouseId?: string) =>
    api.get<ApiResponse<number>>(`/finance/supplier-debts/supplier/${supplierId}/total`, {
      params: warehouseId ? { warehouseId } : undefined
    }),

  paySupplierDebt: (data: PaySupplierDebtRequest) =>
    api.post<ApiResponse<SupplierDebt>>('/finance/supplier-debts/pay', data),

  // ĐÃ SỬA: Thêm hàm getPendingCod để gọi API lọc đơn từ DB
  getPendingCod: (params: { warehouseId?: string; from?: string; to?: string; keyword?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<OrderResponse>>>('/finance/cod-reconciliation/pending', { params }),

  reconcileCOD: (items: any[], warehouseId: string) =>
    api.post<ApiResponse<CodReconciliationResult>>('/finance/cod-reconciliation', items, {
      params: { warehouseId },
    }),
    
  searchCashbook: (params: { warehouseId?: string, from: string, to: string, fundType: string, transactionType: string, keyword: string, page: number, size: number }) => {
    const { warehouseId, ...restParams } = params;
    return api.get<ApiResponse<any>>('/finance/cashbook/search', { 
        params: warehouseId ? { warehouseId, ...restParams } : restParams 
    });
  }
};