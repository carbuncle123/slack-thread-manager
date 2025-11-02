import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { threadsApi } from '../lib/api';
import dayjs from 'dayjs';
import './ThreadDetailPage.css';

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();

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
          <a
            href={thread.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Slackで開く
          </a>
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
    </div>
  );
}
