import api from '@/lib/axios';
import type { ApiResponse, AuditLogResponse } from '@/types';

export const adminService = {
  getAuditLogs: (limit: number = 100) =>
    api.get<ApiResponse<AuditLogResponse[]>>('/admin/audit-logs', { params: { limit } }),
};