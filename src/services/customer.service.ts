import api from '@/lib/axios';
import type { ApiResponse, PageResponse, Customer } from '@/types';

export const customerService = {
  lookup: (phone: string) =>
    api.get<ApiResponse<Customer>>('/customers/lookup', { params: { phone } }),

  // ĐÃ BỔ SUNG: Thêm tham số 'tier' vào param để hỗ trợ tính năng Lọc theo Hạng thẻ
  getAll: (params?: { keyword?: string; tier?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Customer>>>('/customers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/customers/${id}`),

  // ĐÃ CẬP NHẬT: Thay đổi kiểu dữ liệu thành Partial<Customer> để hỗ trợ thêm các trường mới như (address, dateOfBirth, gender, notes...)
  create: (data: Partial<Customer>) =>
    api.post<ApiResponse<Customer>>('/customers', data),

  // BỔ SUNG: Hàm cập nhật thông tin khách hàng.
  // Ghi chú: Chức năng Khóa/Mở khóa (Toggle Active) cũng sẽ dùng hàm update này bằng cách truyền { isActive: false/true }
  update: (id: string, data: Partial<Customer>) =>
    api.put<ApiResponse<Customer>>(`/customers/${id}`, data),

  // BỔ SUNG: Hàm lấy danh sách top khách hàng chi tiêu cao nhất
  getTopSpenders: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<PageResponse<Customer>>>('/customers/top', { params }),
  
  getHistory: (id: string) =>
    api.get<ApiResponse<{ invoices: any[]; orders: any[] }>>(`/customers/${id}/history`),
};