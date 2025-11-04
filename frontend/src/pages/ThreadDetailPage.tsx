import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { threadsApi, summariesApi } from '../lib/api';
import { ThreadEditModal } from '../components/ThreadEditModal';
import dayjs from 'dayjs';
import './ThreadDetailPage.css';

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'daily' | 'topic'>('daily');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: thread, isLoading: threadLoading, error: threadError } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => threadsApi.getThread(threadId!),
    enabled: !!threadId,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => threadsApi.getMessages(threadId!),
    enabled: !!threadId,
  });

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['summary', threadId],
    queryFn: () => summariesApi.getSummary(threadId!),
    enabled: !!threadId,
    retry: false,
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => summariesApi.generateSummary(threadId!, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', threadId] });
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    },
  });

  const handleEditSave = async (updates: {
    title: string;
    tags: string[];
    summary_topic: string;
  }) => {
    await threadsApi.updateThread(threadId!, updates);
    queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    queryClient.invalidateQueries({ queryKey: ['summary', threadId] });
  };

  const handleGenerateSummary = async () => {
    await summariesApi.generateSummary(threadId!, true);
    queryClient.invalidateQueries({ queryKey: ['summary', threadId] });
    queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
  };

  const handleDeleteClick = async () => {
    if (!window.confirm(`「${thread?.title}」を削除してもよろしいですか?\n\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      await threadsApi.deleteThread(threadId!);
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('削除に失敗しました');
    }
  };

  const handleToggleReadStatus = async () => {
    if (!thread) return;

    try {
      if (thread.is_read) {
        // 既読 → 未読にする
        await threadsApi.updateThread(threadId!, { is_read: false });
      } else {
        // 未読 → 既読にする
        await threadsApi.markAsRead(threadId!);
      }
      // スレッド情報を再取得
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    } catch (err) {
      console.error('Failed to toggle read status:', err);
      alert('ステータスの変更に失敗しました');
    }
  };

  if (threadLoading || messagesLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (threadError) {
    return (
      <div className="error">
        エラーが発生しました: {threadError instanceof Error ? threadError.message : '不明なエラー'}
      </div>
    );
  }

  if (!thread) {
    return <div className="error">スレッドが見つかりません</div>;
  }

  return (
    <div className="thread-detail-page">
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 一覧に戻る
          </Link>
          <h2>{thread.title}</h2>
        </div>
        <div className="actions">
          <div className="status-display">
            <span className={`status-badge ${thread.is_read ? 'read' : 'unread'}`}>
              {thread.is_read ? '既読' : '未読'}
            </span>
            {!thread.is_read && thread.new_message_count > 0 && (
              <span className="new-count-badge">+{thread.new_message_count}</span>
            )}
          </div>
          <button
            onClick={handleToggleReadStatus}
            className={`btn ${thread.is_read ? 'btn-warning' : 'btn-success'}`}
          >
            {thread.is_read ? '未読にする' : '既読にする'}
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-secondary"
          >
            編集
          </button>
          <a
            href={thread.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Slackで開く
          </a>
          <button
            onClick={handleDeleteClick}
            className="btn btn-danger"
          >
            削除
          </button>
        </div>
      </div>

      <div className="thread-info">
        <div className="info-item">
          <span className="label">メッセージ数:</span>
          <span>{thread.message_count}</span>
        </div>
        <div className="info-item">
          <span className="label">作成日時:</span>
          <span>{dayjs(thread.created_at).format('YYYY/MM/DD HH:mm')}</span>
        </div>
        <div className="info-item">
          <span className="label">更新日時:</span>
          <span>{dayjs(thread.updated_at).format('YYYY/MM/DD HH:mm')}</span>
        </div>
        {thread.tags.length > 0 && (
          <div className="info-item">
            <span className="label">タグ:</span>
            <div className="thread-tags">
              {thread.tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 要約セクション */}
      <div className="summary-section">
        <div className="section-header">
          <h3>要約</h3>
          {!summary && !summaryLoading && (
            <button
              onClick={() => generateSummaryMutation.mutate()}
              disabled={generateSummaryMutation.isPending}
              className="btn btn-primary"
            >
              {generateSummaryMutation.isPending ? '生成中...' : '要約を生成'}
            </button>
          )}
          {summary && (
            <button
              onClick={() => generateSummaryMutation.mutate()}
              disabled={generateSummaryMutation.isPending}
              className="btn btn-secondary"
            >
              {generateSummaryMutation.isPending ? '再生成中...' : '要約を再生成'}
            </button>
          )}
        </div>

        {summaryLoading && <div className="loading">要約を読み込み中...</div>}

        {generateSummaryMutation.isPending && (
          <div className="summary-generating">
            <p>AIが要約を生成しています。しばらくお待ちください...</p>
          </div>
        )}

        {summaryError && !summaryLoading && !summary && (
          <div className="summary-empty">
            <p>要約が生成されていません。「要約を生成」ボタンをクリックしてください。</p>
          </div>
        )}

        {summary && !generateSummaryMutation.isPending && (
          <div className="summary-content">
            <div className="summary-overview">
              <div className="summary-topic">
                <strong>トピック:</strong> {summary.topic}
              </div>
              <div className="summary-description">
                {summary.overview}
              </div>
              <div className="summary-meta">
                最終更新: {dayjs(summary.last_updated).format('YYYY/MM/DD HH:mm')}
              </div>
            </div>

            <div className="summary-tabs">
              <button
                className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
                onClick={() => setActiveTab('daily')}
              >
                日次要約 ({summary.daily_summaries.length})
              </button>
              <button
                className={`tab ${activeTab === 'topic' ? 'active' : ''}`}
                onClick={() => setActiveTab('topic')}
              >
                トピック別要約 ({summary.topic_summaries.length})
              </button>
            </div>

            <div className="summary-tab-content">
              {activeTab === 'daily' && (
                <div className="daily-summaries">
                  {summary.daily_summaries.map((daily, index) => (
                    <div key={index} className="daily-summary-item">
                      <div className="daily-header">
                        <span className="daily-date">{daily.date}</span>
                        <span className="daily-count">{daily.message_count}件のメッセージ</span>
                      </div>
                      <p className="daily-summary">{daily.summary}</p>
                      {daily.key_points.length > 0 && (
                        <div className="key-points">
                          <strong>重要ポイント:</strong>
                          <ul>
                            {daily.key_points.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'topic' && (
                <div className="topic-summaries">
                  {summary.topic_summaries.map((topic, index) => (
                    <div key={index} className="topic-summary-item">
                      <div className="topic-header">
                        <span className="topic-name">{topic.topic_name}</span>
                        <span className={`topic-status status-${topic.status}`}>
                          {topic.status}
                        </span>
                      </div>
                      <p className="topic-summary">{topic.summary}</p>
                      {topic.conclusion && (
                        <div className="topic-conclusion">
                          <strong>結論:</strong> {topic.conclusion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="messages-section">
        <h3>メッセージ ({messages?.length || 0})</h3>
        {!messages || messages.length === 0 ? (
          <div className="empty-state">メッセージがありません</div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.ts} className="message-item">
                <div className="message-header">
                  <span className="message-user">{message.user_name || message.user}</span>
                  <span className="message-time">
                    {dayjs(message.created_at).format('YYYY/MM/DD HH:mm:ss')}
                  </span>
                </div>
                <div className="message-text">
                  {message.text.split('\n').map((line, index) => (
                    <p key={index}>{line || '\u00A0'}</p>
                  ))}
                </div>
                {message.reactions.length > 0 && (
                  <div className="message-reactions">
                    {message.reactions.map((reaction, index) => (
                      <span key={index} className="reaction">
                        :{reaction.name}: {reaction.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      <ThreadEditModal
        thread={thread}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSave}
        onGenerateSummary={handleGenerateSummary}
      />
    </div>
  );
}
