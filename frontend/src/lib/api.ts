import axios from 'axios';
import type { Thread, ThreadListResponse, ThreadCreate, ThreadUpdate, Message, SyncResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const threadsApi = {
  // スレッド一覧取得
  getThreads: async (params?: {
    tags?: string;
    is_read?: boolean;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<ThreadListResponse> => {
    const response = await api.get<ThreadListResponse>('/api/threads', { params });
    return response.data;
  },

  // 個別スレッド取得
  getThread: async (threadId: string): Promise<Thread> => {
    const response = await api.get<Thread>(`/api/threads/${threadId}`);
    return response.data;
  },

  // スレッド作成
  createThread: async (data: ThreadCreate): Promise<Thread> => {
    const response = await api.post<Thread>('/api/threads', data);
    return response.data;
  },

  // スレッド更新
  updateThread: async (threadId: string, data: ThreadUpdate): Promise<Thread> => {
    const response = await api.put<Thread>(`/api/threads/${threadId}`, data);
    return response.data;
  },

  // スレッド削除
  deleteThread: async (threadId: string): Promise<void> => {
    await api.delete(`/api/threads/${threadId}`);
  },

  // 既読マーク
  markAsRead: async (threadId: string): Promise<Thread> => {
    const response = await api.post<Thread>(`/api/threads/${threadId}/mark-read`);
    return response.data;
  },

  // メッセージ一覧取得
  getMessages: async (threadId: string): Promise<Message[]> => {
    const response = await api.get<Message[]>(`/api/threads/${threadId}/messages`);
    return response.data;
  },

  // メッセージ同期
  syncThread: async (threadId: string): Promise<SyncResponse> => {
    const response = await api.post<SyncResponse>(`/api/threads/${threadId}/sync`);
    return response.data;
  },

  // 全スレッド同期
  syncAll: async (): Promise<any> => {
    const response = await api.post('/api/sync/all');
    return response.data;
  },
};
