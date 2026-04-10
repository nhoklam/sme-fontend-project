import api from '@/lib/axios';
import type { ApiResponse, PageResponse, ShiftResponse, OpenShiftRequest, CloseShiftRequest, CheckoutRequest, InvoiceResponse } from '@/types';

export const posService = {
  // ── Shifts ──────────────────────────────────────────────────
  openShift: (data: OpenShiftRequest) =>
    api.post<ApiResponse<ShiftResponse>>('/pos/shifts/open', data),

  closeShift: (data: CloseShiftRequest) =>
    api.post<ApiResponse<ShiftResponse>>('/pos/shifts/close', data),

  getCurrentShift: () =>
    api.get<ApiResponse<ShiftResponse>>('/pos/shifts/current'),

  getPendingShifts: () =>
    api.get<ApiResponse<ShiftResponse[]>>('/pos/shifts/pending'),

  approveShift: (id: string) =>
    api.post<ApiResponse<ShiftResponse>>(`/pos/shifts/${id}/approve`),

  // ── Checkout ────────────────────────────────────────────────
  checkout: (data: CheckoutRequest) =>
    api.post<ApiResponse<InvoiceResponse>>('/pos/checkout', data),

  // ── Invoices ────────────────────────────────────────────────
  getInvoice: (id: string) =>
    api.get<ApiResponse<InvoiceResponse>>(`/pos/invoices/${id}`),

  getInvoicesByShift: (shiftId: string, page = 0, size = 20) =>
    api.get<ApiResponse<PageResponse<InvoiceResponse>>>('/pos/invoices', {
      params: { shiftId, page, size },
    }),

  // ── Returns / Refunds ───────────────────────────────────────
  getInvoiceByCode: (code: string) =>
    api.get<ApiResponse<InvoiceResponse>>(`/pos/invoices/code/${code}`),

  refund: (data: { originalInvoiceId: string; shiftId: string; items: { productId: string; quantity: number }[]; returnDestination: string; note: string; }) =>
    api.post<ApiResponse<InvoiceResponse>>('/pos/refund', data),
};