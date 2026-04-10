import api from '@/lib/axios';
import type { ApiResponse, AiChatRequest, AiChatResponse } from '@/types';

// BỔ SUNG TYPE NÀY
export interface KnowledgeDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  chunkCount: number;
  createdAt: string;
}

export const aiService = {
  chat: (data: AiChatRequest) =>
    api.post<ApiResponse<AiChatResponse>>('/ai/chat', data),

  searchSemantic: (query: string, topK = 5) =>
    api.get<ApiResponse<any[]>>('/ai/search', { params: { query, topK } }),

  uploadDocument: (file: File, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return api.post<ApiResponse<{ title: string; chunks: number; status: string }>>('/ai/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // THÊM 2 DÒNG NÀY:
  getDocuments: () => api.get<ApiResponse<KnowledgeDocument[]>>('/ai/documents'),
  deleteDocument: (id: string) => api.delete<ApiResponse<void>>(`/ai/documents/${id}`),
  getDocumentChunks: (id: string) => api.get<ApiResponse<string[]>>(`/ai/documents/${id}/chunks`),
};