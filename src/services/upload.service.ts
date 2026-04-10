import api from '@/lib/axios';
import type { ApiResponse } from '@/types';

export const uploadService = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<{ url: string }>>('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};