import { useState, useEffect, useCallback } from 'react';
import { channelExportApi } from '../lib/api';
import type { ChannelExportConfig, ChannelDownloadState, DownloadJobStatus } from '../types';
import './ChannelExportPage.css';

function ChannelExportPage() {
  const [config, setConfig] = useState<ChannelExportConfig | null>(null);
  const [channelStates, setChannelStates] = useState<ChannelDownloadState[]>([]);
  const [currentJob, setCurrentJob] = useState<DownloadJobStatus | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // フォーム
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [configData, statusData] = await Promise.all([
        channelExportApi.getConfig(),
        channelExportApi.getStatus(),
      ]);
      setConfig(configData);
      setChannelStates(statusData.channels);
      setCurrentJob(statusData.job);
      setError('');
    } catch (err) {
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ジョブ実行中はポーリング
  useEffect(() => {
    if (currentJob?.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const statusData = await channelExportApi.getStatus();
        setChannelStates(statusData.channels);
        setCurrentJob(statusData.job);
        if (statusData.job?.status !== 'running') {
          clearInterval(interval);
        }
      } catch {
        // ポーリングエラーは無視
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentJob?.status]);

  const handleAddChannel = async () => {
    if (!newChannelId.trim() || !newChannelName.trim()) return;
    try {
      const updated = await channelExportApi.addChannel({
        channel_id: newChannelId.trim(),
        channel_name: newChannelName.trim(),
        enabled: true,
      });
      setConfig(updated);
      setNewChannelId('');
      setNewChannelName('');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'チャンネルの追加に失敗しました');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const updated = await channelExportApi.deleteChannel(channelId);
      setConfig(updated);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'チャンネルの削除に失敗しました');
    }
  };

  const handleDownloadAll = async () => {
    try {
      await channelExportApi.downloadAll();
      setError('');
      // ステータスを更新
      const statusData = await channelExportApi.getStatus();
      setCurrentJob(statusData.job);
      setChannelStates(statusData.channels);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ダウンロードの開始に失敗しました');
    }
  };

  const handleDownloadChannel = async (channelId: string) => {
    try {
      await channelExportApi.downloadChannel(channelId);
      setError('');
      const statusData = await channelExportApi.getStatus();
      setCurrentJob(statusData.job);
      setChannelStates(statusData.channels);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ダウンロードの開始に失敗しました');
    }
  };

  const handleScheduleToggle = async () => {
    if (!config) return;
    try {
      const updated = await channelExportApi.updateConfig({
        ...config,
        schedule_enabled: !config.schedule_enabled,
      });
      setConfig(updated);
    } catch {
      setError('設定の更新に失敗しました');
    }
  };

  const handleIntervalChange = async (hours: number) => {
    if (!config || hours < 1) return;
    try {
      const updated = await channelExportApi.updateConfig({
        ...config,
        schedule_interval_hours: hours,
      });
      setConfig(updated);
    } catch {
      setError('設定の更新に失敗しました');
    }
  };

  const getStateForChannel = (channelId: string): ChannelDownloadState | undefined => {
    return channelStates.find(s => s.channel_id === channelId);
  };

  if (loading) return <div className="export-page"><p>読み込み中...</p></div>;

  return (
    <div className="export-page">
      <div className="page-header">
        <h2>チャンネルデータ ダウンロード</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* チャンネル設定セクション */}
      <div className="export-section">
        <h3>ダウンロード対象チャンネル</h3>

        <div className="add-channel-form">
          <div className="form-field">
            <label>チャンネルID</label>
            <input
              type="text"
              value={newChannelId}
              onChange={e => setNewChannelId(e.target.value)}
              placeholder="C01ABC..."
            />
          </div>
          <div className="form-field">
            <label>チャンネル名</label>
            <input
              type="text"
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              placeholder="general"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAddChannel}
            disabled={!newChannelId.trim() || !newChannelName.trim()}
          >
            追加
          </button>
        </div>

        {config && config.channels.length > 0 ? (
          <div className="channel-list">
            {config.channels.map(ch => {
              const state = getStateForChannel(ch.channel_id);
              return (
                <div key={ch.channel_id} className="channel-item">
                  <div className="channel-info">
                    <span className="channel-name">#{ch.channel_name}</span>
                    <span className="channel-id">{ch.channel_id}</span>
                  </div>
                  <div className="channel-actions">
                    {state && (
                      <span className={`status-badge ${state.status}`}>
                        {state.status === 'completed' ? '完了' :
                         state.status === 'downloading' ? 'DL中' :
                         state.status === 'error' ? 'エラー' : '未実行'}
                      </span>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadChannel(ch.channel_id)}
                      disabled={currentJob?.status === 'running'}
                    >
                      DL
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteChannel(ch.channel_id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>ダウンロード対象のチャンネルが登録されていません</p>
          </div>
        )}

        {/* スケジュール設定 */}
        {config && (
          <div className="schedule-config">
            <div className="schedule-toggle">
              <input
                type="checkbox"
                id="schedule-enabled"
                checked={config.schedule_enabled}
                onChange={handleScheduleToggle}
              />
              <label htmlFor="schedule-enabled">定期実行</label>
            </div>
            {config.schedule_enabled && (
              <div className="schedule-interval">
                <span>間隔:</span>
                <input
                  type="number"
                  min={1}
                  value={config.schedule_interval_hours}
                  onChange={e => handleIntervalChange(parseInt(e.target.value, 10))}
                />
                <span>時間</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ダウンロードステータスセクション */}
      <div className="export-section">
        <div className="download-header">
          <h3>ダウンロード状態</h3>
          <button
            className="btn btn-primary"
            onClick={handleDownloadAll}
            disabled={!config?.channels.length || currentJob?.status === 'running'}
          >
            {currentJob?.status === 'running' ? 'ダウンロード中...' : '全チャンネル ダウンロード'}
          </button>
        </div>

        {/* 進捗バー */}
        {currentJob?.status === 'running' && (
          <div className="progress-bar-container">
            <p>ダウンロード中... {Math.round(currentJob.progress_percent)}%</p>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${currentJob.progress_percent}%` }}
              />
            </div>
          </div>
        )}

        {channelStates.length > 0 ? (
          <div className="status-list">
            {channelStates.map(state => (
              <div key={state.channel_id} className="status-item">
                <div className="status-info">
                  <span className="channel-name">#{state.channel_name}</span>
                  <div className="status-meta">
                    <span>メッセージ: {state.total_messages_downloaded}</span>
                    <span>スレッド: {state.total_threads_downloaded}</span>
                    {state.last_downloaded_at && (
                      <span>最終DL: {new Date(state.last_downloaded_at).toLocaleString('ja-JP')}</span>
                    )}
                  </div>
                  {state.error_message && (
                    <span style={{ color: '#c33', fontSize: '0.75rem' }}>{state.error_message}</span>
                  )}
                </div>
                <span className={`status-badge ${state.status}`}>
                  {state.status === 'completed' ? '完了' :
                   state.status === 'downloading' ? 'DL中' :
                   state.status === 'error' ? 'エラー' : '未実行'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>ダウンロード履歴はありません</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelExportPage;
