import axios from 'axios';
import type {
  Thread,
  ThreadListResponse,
  ThreadCreate,
  ThreadUpdate,
  Message,
  SyncResponse,
  ThreadSummary,
  SummaryResponse,
  DiscoverRequest,
  DiscoverResponse,
  RegisterThreadsRequest,
  RegisterThreadsResponse,
  QueryRequest,
  QueryResponse,
  SearchHistoryItem,
  BookmarkRequest
} from '../types';

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

export const summariesApi = {
  // 要約取得
  getSummary: async (threadId: string): Promise<ThreadSummary> => {
    const response = await api.get<ThreadSummary>(`/api/summaries/${threadId}`);
    return response.data;
  },

  // 要約生成
  generateSummary: async (threadId: string, forceRegenerate: boolean = false): Promise<SummaryResponse> => {
    const response = await api.post<SummaryResponse>('/api/summaries/generate', {
      thread_id: threadId,
      force_regenerate: forceRegenerate,
    });
    return response.data;
  },

  // 要約削除
  deleteSummary: async (threadId: string): Promise<void> => {
    await api.delete(`/api/summaries/${threadId}`);
  },
};

export const discoverApi = {
  // 新規スレッド発見
  discoverThreads: async (request: DiscoverRequest = {}): Promise<DiscoverResponse> => {
    const response = await api.post<DiscoverResponse>('/api/discover/threads', request);
    return response.data;
  },

  // スレッド一括登録
  registerThreads: async (request: RegisterThreadsRequest): Promise<RegisterThreadsResponse> => {
    const response = await api.post<RegisterThreadsResponse>('/api/discover/register', request);
    return response.data;
  },
};

export const searchApi = {
  // 自然言語質問
  query: async (request: QueryRequest): Promise<QueryResponse> => {
    const response = await api.post<QueryResponse>('/api/search/query', request);
    return response.data;
  },

  // 検索履歴取得
  getHistory: async (): Promise<SearchHistoryItem[]> => {
    const response = await api.get<SearchHistoryItem[]>('/api/search/history');
    return response.data;
  },

  // ブックマーク済み検索履歴取得
  getBookmarks: async (): Promise<SearchHistoryItem[]> => {
    const response = await api.get<SearchHistoryItem[]>('/api/search/history/bookmarks');
    return response.data;
  },

  // 検索結果をブックマーク
  bookmark: async (queryId: string, bookmarked: boolean): Promise<void> => {
    await api.post(`/api/search/history/${queryId}/bookmark`, { bookmarked });
  },

  // 検索履歴削除
  deleteQuery: async (queryId: string): Promise<void> => {
    await api.delete(`/api/search/history/${queryId}`);
  },
};
