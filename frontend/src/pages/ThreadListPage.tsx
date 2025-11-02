import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { threadsApi } from '../lib/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';
import './ThreadListPage.css';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export default function ThreadListPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['threads'],
    queryFn: () => threadsApi.getThreads(),
  });

  const handleSyncAll = async () => {
    try {
      await threadsApi.syncAll();
      refetch();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  if (isLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="error">
        エラーが発生しました: {error instanceof Error ? error.message : '不明なエラー'}
      </div>
    );
  }

  const threads = data?.threads || [];

  return (
    <div className="thread-list-page">
      <div className="page-header">
        <h2>スレッド一覧</h2>
        <div className="actions">
          <Link to="/discover" className="btn btn-secondary">
            新規スレッド発見
          </Link>
          <button onClick={handleSyncAll} className="btn btn-primary">
            全スレッド同期
          </button>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="empty-state">
          <p>スレッドが登録されていません</p>
        </div>
      ) : (
        <div className="thread-list">
          {threads.map((thread) => (
            <div key={thread.id} className="thread-card">
              <div className="thread-card-header">
                <h3>
                  <Link to={`/threads/${thread.id}`}>{thread.title}</Link>
                  {!thread.is_read && thread.new_message_count > 0 && (
                    <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>
                      {thread.new_message_count} 件の新着
                    </span>
                  )}
                </h3>
              </div>

              <div className="thread-card-body">
                {thread.summary.topic && (
                  <p className="thread-summary">{thread.summary.topic}</p>
                )}

                <div className="thread-meta">
                  <span>メッセージ数: {thread.message_count}</span>
                  <span>•</span>
                  <span>更新: {dayjs(thread.updated_at).fromNow()}</span>
                </div>

                {thread.tags.length > 0 && (
                  <div className="thread-tags">
                    {thread.tags.map((tag, index) => (
                      <span key={index} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="thread-card-footer">
                <a
                  href={thread.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary"
                >
                  Slackで開く
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
