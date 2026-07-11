
import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface CashierDashboardData {
  shift: { id?: string; status: 'OPEN' | 'NOT_OPEN'; openedAt?: string; startingCash?: number };
  currentShiftStats: { invoiceCount: number; totalRevenue: number };
  pendingPackCount: number;
  lowStockCount: number;
}

export interface ManagerDashboardData {
  revenue: { today: number; todayVsYesterdayPercent: number; thisMonth: number; monthVsLastMonthPercent: number };
  invoiceCount: { pos: number; online: number };
  pendingShifts: { shiftId: string; cashierId: string; closedAt: string; discrepancyAmount: number }[];
  orders: { pendingConfirm: number; pendingPack: number };
  lowStockCount: number;
  upcomingDebts: number;
}

export interface AdminDashboardData {
  totalRevenue: { today: number; thisMonth: number };
  revenueByBranch: { warehouseId: string; name: string; today: number; yesterday: number }[];
  alertBranches: { warehouseId: string; name: string; managerName: string | null; issues: string[] }[];
  totalOnlineOrders: { today: number };
  totalSupplierDebt: number;
}

export const dashboardService = {
  getCashierDashboard: () => api.get<ApiResponse<CashierDashboardData>>('/dashboard/cashier'),
  getManagerDashboard: () => api.get<ApiResponse<ManagerDashboardData>>('/dashboard/manager'),
  getAdminDashboard: () => api.get<ApiResponse<AdminDashboardData>>('/dashboard/admin'),
};
