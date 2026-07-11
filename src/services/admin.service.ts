import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AuditLogResponse {
  id: string | null;
  entityName: string;
  entityId: string;
  actionType: string;
  changedBy: string;
  changedAt: string;
  revision: number | null;
  oldValueJson: string | null;
  newValueJson: string | null;
  warehouseId: string | null;
  source: 'BUSINESS_ACTION' | 'FIELD_CHANGE';
}

export interface AuditLogPageResult {
  content: AuditLogResponse[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface AuditLogFilterParams {
  entityType?: string;
  action?: string;
  changedBy?: string;
  fromDate?: string; // ISO datetime
  toDate?: string;
  page?: number;
  size?: number;
}

export const adminService = {
  /**
   * [UPDATED] Hỗ trợ filter + pagination thay vì chỉ limit cứng.
   * Backward-compat: gọi không truyền params vẫn hoạt động (page=0, size=30).
   */
  getAuditLogs: (params?: AuditLogFilterParams) =>
    api.get<ApiResponse<AuditLogPageResult>>('/admin/audit-logs', { params }),
};
