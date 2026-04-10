import api from '@/lib/axios';
import type { ApiResponse, AuthResponse, LoginRequest, UserResponse, CreateUserRequest, ChangePasswordRequest } from '@/types';

export const authService = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/refresh', { refreshToken }),

  getMe: () =>
    api.get<ApiResponse<UserResponse>>('/auth/me'),

  changePassword: (data: ChangePasswordRequest) =>
    api.put<ApiResponse<void>>('/auth/change-password', data),

  getUsers: (params?: { keyword?: string; role?: string; warehouseId?: string }) => 
    api.get<ApiResponse<any[]>>('/auth/users', { params }),

  createUser: (data: CreateUserRequest) =>
    api.post<ApiResponse<UserResponse>>('/auth/users', data),

  activateUser: (id: string) =>
    api.patch<ApiResponse<UserResponse>>(`/auth/users/${id}/activate`),

  deactivateUser: (id: string) =>
    api.patch<ApiResponse<UserResponse>>(`/auth/users/${id}/deactivate`),
  updateUser: (id: string, data: any) =>
    api.put<ApiResponse<any>>(`/auth/users/${id}`, data),
};
