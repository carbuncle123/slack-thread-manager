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
  MonitoredChannel,
  AppConfig,
  ThreadView,
  CreateViewRequest,
  UpdateViewRequest,
  SetDefaultRequest
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
    is_archived?: boolean;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    limit?: number;
    offset?: number;
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

  // スレッド質問（LLM）
  queryThread: async (threadId: string, query: string): Promise<{ answer: string; confidence: number }> => {
    const response = await api.post<{ answer: string; confidence: number }>(
      `/api/threads/${threadId}/query`,
      { query }
    );
    return response.data;
  },

  // アーカイブ
  archiveThread: async (threadId: string): Promise<Thread> => {
    const response = await api.post<Thread>(`/api/threads/${threadId}/archive`);
    return response.data;
  },

  // アーカイブ解除
  unarchiveThread: async (threadId: string): Promise<Thread> => {
    const response = await api.post<Thread>(`/api/threads/${threadId}/unarchive`);
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

export const configApi = {
  // 設定取得
  getConfig: async (): Promise<AppConfig> => {
    const response = await api.get<AppConfig>('/api/config');
    return response.data;
  },

  // 設定更新
  updateConfig: async (config: AppConfig): Promise<AppConfig> => {
    const response = await api.put<AppConfig>('/api/config', config);
    return response.data;
  },

  // 監視チャンネル一覧取得
  getMonitoredChannels: async (): Promise<MonitoredChannel[]> => {
    const response = await api.get<MonitoredChannel[]>('/api/config/channels');
    return response.data;
  },

  // 監視チャンネル追加
  addMonitoredChannel: async (channel: MonitoredChannel): Promise<AppConfig> => {
    const response = await api.post<AppConfig>('/api/config/channels', channel);
    return response.data;
  },

  // 監視チャンネル更新
  updateMonitoredChannel: async (channelId: string, channel: MonitoredChannel): Promise<AppConfig> => {
    const response = await api.put<AppConfig>(`/api/config/channels/${channelId}`, channel);
    return response.data;
  },

  // 監視チャンネル削除
  deleteMonitoredChannel: async (channelId: string): Promise<AppConfig> => {
    const response = await api.delete<AppConfig>(`/api/config/channels/${channelId}`);
    return response.data;
  },

  // デフォルトメンションユーザー取得
  getDefaultMentionUsers: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/api/config/default-mention-users');
    return response.data;
  },

  // デフォルトメンションユーザー更新
  updateDefaultMentionUsers: async (users: string[]): Promise<AppConfig> => {
    const response = await api.put<AppConfig>('/api/config/default-mention-users', { users });
    return response.data;
  },

  // Slack認証情報更新
  updateSlackCredentials: async (xoxcToken: string, cookie: string): Promise<AppConfig> => {
    const response = await api.put<AppConfig>('/api/config/slack-credentials', {
      xoxc_token: xoxcToken,
      cookie: cookie,
    });
    return response.data;
  },
};

export const viewsApi = {
  // ビュー一覧取得
  getViews: async (): Promise<ThreadView[]> => {
    const response = await api.get<ThreadView[]>('/api/views');
    return response.data;
  },

  // 個別ビュー取得
  getView: async (viewId: string): Promise<ThreadView> => {
    const response = await api.get<ThreadView>(`/api/views/${viewId}`);
    return response.data;
  },

  // ビュー作成
  createView: async (request: CreateViewRequest): Promise<ThreadView> => {
    const response = await api.post<ThreadView>('/api/views', request);
    return response.data;
  },

  // ビュー更新
  updateView: async (viewId: string, request: UpdateViewRequest): Promise<ThreadView> => {
    const response = await api.put<ThreadView>(`/api/views/${viewId}`, request);
    return response.data;
  },

  // ビュー削除
  deleteView: async (viewId: string): Promise<void> => {
    await api.delete(`/api/views/${viewId}`);
  },

  // デフォルトビュー設定
  setDefault: async (viewId: string, request: SetDefaultRequest): Promise<ThreadView> => {
    const response = await api.put<ThreadView>(`/api/views/${viewId}/default`, request);
    return response.data;
  },
};

export const tagsApi = {
  // タグ一覧取得
  getTags: async (): Promise<string[]> => {
    const response = await api.get<{ tags: string[] }>('/api/tags');
    return response.data.tags;
  },

  // タグ作成
  createTag: async (name: string): Promise<void> => {
    await api.post('/api/tags', { name });
  },

  // タグ更新
  updateTag: async (oldName: string, newName: string): Promise<void> => {
    await api.put('/api/tags', { old_name: oldName, new_name: newName });
  },

  // タグ削除
  deleteTag: async (name: string): Promise<void> => {
    await api.delete(`/api/tags/${encodeURIComponent(name)}`);
  },
};
