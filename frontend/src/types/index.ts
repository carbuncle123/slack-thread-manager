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

export interface ThreadUpdate {
  title?: string;
  tags?: string[];
  is_read?: boolean;
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
