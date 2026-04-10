import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  getUnread: () =>
    api.get<ApiResponse<Notification[]>>('/notifications/unread'),

  countUnread: () =>
    api.get<ApiResponse<number>>('/notifications/count-unread'),

  markAsRead: (id: string) =>
    api.patch<ApiResponse<void>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<ApiResponse<void>>('/notifications/read-all'),

  getAll: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<any>>('/notifications', { params }),
};
