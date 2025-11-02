import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { discoverApi } from '../lib/api';
import type { DiscoveredThread } from '../types';
import dayjs from 'dayjs';
import './DiscoverPage.css';

export default function DiscoverPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [discoveredThreads, setDiscoveredThreads] = useState<DiscoveredThread[]>([]);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(7);

  const discoverMutation = useMutation({
    mutationFn: () => discoverApi.discoverThreads({ days }),
    onSuccess: (data) => {
      setDiscoveredThreads(data.discovered_threads);
      setSelectedThreads(new Set());
    },
  });

  const registerMutation = useMutation({
    mutationFn: (threads: Array<{ channel_id: string; thread_ts: string; title: string; tags: string[]; url: string }>) =>
      discoverApi.registerThreads({ threads }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      alert(`${data.registered_count}件のスレッドを登録しました${data.failed_count > 0 ? `\n失敗: ${data.failed_count}件` : ''}`);

      if (data.success) {
        navigate('/');
      }
    },
  });

  const toggleThread = (threadKey: string) => {
    const newSelected = new Set(selectedThreads);
    if (newSelected.has(threadKey)) {
      newSelected.delete(threadKey);
    } else {
      newSelected.add(threadKey);
    }
    setSelectedThreads(newSelected);
  };

  const toggleAll = () => {
    if (selectedThreads.size === discoveredThreads.length) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(discoveredThreads.map(t => `${t.channel_id}:${t.thread_ts}`)));
    }
  };

  const handleRegisterSelected = () => {
    const threadsToRegister = discoveredThreads
      .filter(t => selectedThreads.has(`${t.channel_id}:${t.thread_ts}`))
      .map(t => ({
        channel_id: t.channel_id,
        thread_ts: t.thread_ts,
        title: t.first_message_text.substring(0, 100),
        tags: [`discovered-${t.matched_condition}`],
        url: t.url
      }));

    if (threadsToRegister.length === 0) {
      alert('登録するスレッドを選択してください');
      return;
    }

    registerMutation.mutate(threadsToRegister);
  };

  return (
    <div className="discover-page">
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← 一覧に戻る
          </Link>
          <h2>新規スレッド発見</h2>
        </div>
      </div>

      <div className="discover-controls">
        <div className="control-group">
          <label htmlFor="days">検索期間:</label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={discoverMutation.isPending}
          >
            <option value={1}>過去1日</option>
            <option value={3}>過去3日</option>
            <option value={7}>過去7日</option>
            <option value={14}>過去14日</option>
            <option value={30}>過去30日</option>
          </select>
        </div>

        <button
          onClick={() => discoverMutation.mutate()}
          disabled={discoverMutation.isPending}
          className="btn btn-primary"
        >
          {discoverMutation.isPending ? '検索中...' : 'スレッドを発見'}
        </button>
      </div>

      {discoverMutation.isError && (
        <div className="error-message">
          エラーが発生しました: {discoverMutation.error instanceof Error ? discoverMutation.error.message : '不明なエラー'}
        </div>
      )}

      {discoveredThreads.length > 0 && (
        <>
          <div className="results-header">
            <h3>{discoveredThreads.length}件の新規スレッドを発見しました</h3>
            <div className="results-actions">
              <button
                onClick={toggleAll}
                className="btn btn-secondary"
              >
                {selectedThreads.size === discoveredThreads.length ? '全て解除' : '全て選択'}
              </button>
              <button
                onClick={handleRegisterSelected}
                disabled={selectedThreads.size === 0 || registerMutation.isPending}
                className="btn btn-primary"
              >
                {registerMutation.isPending ? '登録中...' : `選択中のスレッドを登録 (${selectedThreads.size})`}
              </button>
            </div>
          </div>

          <div className="discovered-threads-list">
            {discoveredThreads.map((thread) => {
              const threadKey = `${thread.channel_id}:${thread.thread_ts}`;
              const isSelected = selectedThreads.has(threadKey);

              return (
                <div
                  key={threadKey}
                  className={`discovered-thread-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleThread(threadKey)}
                >
                  <div className="thread-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleThread(threadKey)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="thread-content">
                    <div className="thread-header">
                      <span className="channel-name">#{thread.channel_name}</span>
                      <span className="thread-time">
                        {dayjs(thread.created_at).format('YYYY/MM/DD HH:mm')}
                      </span>
                    </div>
                    <div className="thread-message">
                      {thread.first_message_text}
                    </div>
                    <div className="thread-meta">
                      <span className="match-info">
                        {thread.matched_condition === 'mention' ? 'メンション' : 'キーワード'}: {thread.matched_value}
                      </span>
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="slack-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Slackで開く →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {discoveredThreads.length === 0 && !discoverMutation.isPending && !discoverMutation.isError && (
        <div className="empty-state">
          <p>「スレッドを発見」ボタンをクリックして、新規スレッドを検索してください</p>
          <p className="empty-state-note">
            ※ 検索を実行するには、事前に監視チャンネルの設定が必要です
          </p>
        </div>
      )}
    </div>
  );
}
