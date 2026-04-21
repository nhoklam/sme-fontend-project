import api from '@/lib/axios';
import type { ApiResponse, CashbookTransaction, CreateCashbookEntryRequest, SupplierDebt, PaySupplierDebtRequest, CodReconciliationResult } from '@/types';

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

  getTotalOutstandingBySupplier: (supplierId: string) =>
    api.get<ApiResponse<number>>(`/finance/supplier-debts/supplier/${supplierId}/total`),

  paySupplierDebt: (data: PaySupplierDebtRequest) =>
    api.post<ApiResponse<SupplierDebt>>('/finance/supplier-debts/pay', data),

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