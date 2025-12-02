// API型定義

export interface Thread {
  id: string;
  channel_id: string;
  thread_ts: string;
  title: string;
  url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_message_ts: string | null;
  message_count: number;
  new_message_count: number;
  is_read: boolean;
  is_archived: boolean;
  has_daily_summary: boolean;
  has_topic_summary: boolean;
  summary: {
    topic: string;
    generated_at: string | null;
  };
}

export interface Message {
  ts: string;
  user: string;
  user_name: string | null;
  text: string;
  reactions: Reaction[];
  files: any[];
  created_at: string;
}

export interface Reaction {
  name: string;
  count: number;
}

export interface ThreadListResponse {
  threads: Thread[];
  total: number;
}

export interface ThreadCreate {
  channel_id: string;
  thread_ts: string;
  title: string;
  tags: string[];
}

// 検索・質問関連の型定義
export interface QueryRequest {
  query: string;
}

export interface RelatedThread {
  thread_id: string;
  title: string;
  url?: string;
}

export interface QueryResponse {
  query_id: string;
  query: string;
  answer: string;
  related_threads: RelatedThread[];
  confidence: number;
  created_at: string;
}

export interface SearchHistoryItem {
  query_id: string;
  query: string;
  answer: string;
  related_threads: RelatedThread[];
  confidence: number;
  created_at: string;
  bookmarked: boolean;
}

export interface BookmarkRequest {
  bookmarked: boolean;
}

export interface ThreadUpdate {
  title?: string;
  tags?: string[];
  is_read?: boolean;
  is_archived?: boolean;
}

export interface SyncResponse {
  thread_id: string;
  total_messages: number;
  new_messages: number;
  synced_at: string;
}

// 要約関連の型

export interface DailySummaryItem {
  date: string;
  message_count: number;
  summary: string;
  key_points: string[];
  participants: string[];
}

export interface TopicSummaryItem {
  topic_name: string;
  status: string;
  summary: string;
  conclusion: string | null;
  related_message_timestamps: string[];
  participants: string[];
}

export interface ThreadSummary {
  thread_id: string;
  topic: string;
  overview: string;
  daily_summaries: DailySummaryItem[];
  topic_summaries: TopicSummaryItem[];
  last_updated: string;
  message_count_at_summary: number;
}

export interface SummaryResponse {
  success: boolean;
  summary: ThreadSummary | null;
  message: string;
}

// 新規スレッド発見関連の型

export interface DiscoveredThread {
  channel_id: string;
  channel_name: string;
  thread_ts: string;
  first_message_text: string;
  first_message_user: string;
  first_message_user_name: string | null;
  created_at: string;
  message_count: number;
  url: string;
  matched_condition: string;
  matched_value: string;
}

export interface DiscoverRequest {
  channel_ids?: string[];
  days?: number;
}

export interface DiscoverResponse {
  discovered_threads: DiscoveredThread[];
  total_count: number;
  searched_channels: string[];
}

export interface RegisterThreadsRequest {
  threads: Array<{
    channel_id: string;
    thread_ts: string;
    title: string;
    tags: string[];
    url: string;
  }>;
}

export interface RegisterThreadsResponse {
  success: boolean;
  registered_count: number;
  failed_count: number;
  errors: string[];
}

// 設定関連の型定義
export interface MonitoredChannel {
  channel_id: string;
  channel_name: string;
  mention_users: string[];
  keywords: string[];
}

export interface SlackConfig {
  workspace: string;
  xoxc_token: string;
  cookie: string;
  monitored_channels: MonitoredChannel[];
}

export interface AppConfig {
  slack: SlackConfig;
  sync: {
    auto_sync_enabled: boolean;
    sync_interval_minutes: number;
    last_sync_at: string | null;
  };
  llm: {
    chatgpt_api_key: string | null;
    chatgpt_model: string;
    chatgpt_max_tokens: number;
    claude_api_key: string | null;
    claude_agent_enabled: boolean;
  };
  app: {
    theme: string;
    items_per_page: number;
  };
}

// ビュー関連の型定義
export interface ViewFilters {
  tags: string[];
  is_read: boolean | null;
  search: string;
  date_from: string | null;
  date_to: string | null;
  has_new_messages: boolean;
}

export interface ViewSort {
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

export interface ThreadView {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  filters: ViewFilters;
  sort: ViewSort;
  created_at: string;
  updated_at: string;
}

export interface CreateViewRequest {
  name: string;
  description?: string | null;
  is_default: boolean;
  filters: ViewFilters;
  sort: ViewSort;
}

export interface UpdateViewRequest {
  name: string;
  description?: string | null;
  is_default: boolean;
  filters: ViewFilters;
  sort: ViewSort;
}

export interface SetDefaultRequest {
  is_default: boolean;
}
