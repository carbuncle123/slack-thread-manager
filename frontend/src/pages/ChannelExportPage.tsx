import { useState, useEffect, useCallback } from 'react';
import { channelExportApi } from '../lib/api';
import type {
  ChannelExportConfig,
  ChannelDownloadState,
  DownloadJobStatus,
  ProjectMetadata,
  ProjectUserMetadataConfig,
  UserMetadata,
} from '../types';
import './ChannelExportPage.css';

function ChannelExportPage() {
  const [config, setConfig] = useState<ChannelExportConfig | null>(null);
  const [metadata, setMetadata] = useState<ProjectUserMetadataConfig | null>(null);
  const [channelStates, setChannelStates] = useState<ChannelDownloadState[]>([]);
  const [currentJob, setCurrentJob] = useState<DownloadJobStatus | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  const [newProjectId, setNewProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectChannels, setNewProjectChannels] = useState('');
  const [newProjectKeywords, setNewProjectKeywords] = useState('');

  const [newUserId, setNewUserId] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');

  const parseCsv = (value: string): string[] => {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  };

  const toCsv = (values: string[]): string => values.join(', ');

  const loadData = useCallback(async () => {
    try {
      const [configData, statusData, metadataData] = await Promise.all([
        channelExportApi.getConfig(),
        channelExportApi.getStatus(),
        channelExportApi.getMetadataConfig(),
      ]);
      setConfig(configData);
      setChannelStates(statusData.channels);
      setCurrentJob(statusData.job);
      setMetadata(metadataData);
      setError('');
    } catch {
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const updateProject = (index: number, updater: (item: ProjectMetadata) => ProjectMetadata) => {
    if (!metadata) return;
    setMetadata({
      ...metadata,
      projects: metadata.projects.map((item, i) => (i === index ? updater(item) : item)),
    });
  };

  const deleteProject = (index: number) => {
    if (!metadata) return;
    setMetadata({
      ...metadata,
      projects: metadata.projects.filter((_, i) => i !== index),
    });
  };

  const handleAddProject = () => {
    if (!metadata || !newProjectId.trim() || !newProjectName.trim()) return;
    const project: ProjectMetadata = {
      project_id: newProjectId.trim(),
      name: newProjectName.trim(),
      target_channel_ids: parseCsv(newProjectChannels),
      keywords: parseCsv(newProjectKeywords),
    };
    setMetadata({
      ...metadata,
      projects: [...metadata.projects, project],
    });
    setNewProjectId('');
    setNewProjectName('');
    setNewProjectChannels('');
    setNewProjectKeywords('');
  };

  const updateUser = (index: number, updater: (item: UserMetadata) => UserMetadata) => {
    if (!metadata) return;
    setMetadata({
      ...metadata,
      users: metadata.users.map((item, i) => (i === index ? updater(item) : item)),
    });
  };

  const deleteUser = (index: number) => {
    if (!metadata) return;
    setMetadata({
      ...metadata,
      users: metadata.users.filter((_, i) => i !== index),
    });
  };

  const handleAddUser = () => {
    if (!metadata || !newUserId.trim() || !newUserDisplayName.trim()) return;
    const user: UserMetadata = {
      user_id: newUserId.trim(),
      display_name: newUserDisplayName.trim(),
    };
    setMetadata({
      ...metadata,
      users: [...metadata.users, user],
    });
    setNewUserId('');
    setNewUserDisplayName('');
  };

  const handleSaveMetadata = async () => {
    if (!metadata) return;
    const payload: ProjectUserMetadataConfig = {
      ...metadata,
      projects: metadata.projects
        .map(project => ({
          ...project,
          project_id: project.project_id.trim(),
          name: project.name.trim(),
          target_channel_ids: project.target_channel_ids.map(v => v.trim()).filter(Boolean),
          keywords: project.keywords.map(v => v.trim()).filter(Boolean),
        }))
        .filter(project => project.project_id && project.name),
      users: metadata.users
        .map(user => ({
          user_id: user.user_id.trim(),
          display_name: user.display_name.trim(),
        }))
        .filter(user => user.user_id && user.display_name),
    };
    try {
      const updated = await channelExportApi.updateMetadataConfig(payload);
      setMetadata(updated);
      setError('');
    } catch {
      setError('project/user設定の保存に失敗しました');
    }
  };

  const handleRefreshDisplayNames = async () => {
    try {
      const updated = await channelExportApi.refreshUserDisplayNames();
      setMetadata(updated);
      setError('');
    } catch {
      setError('display_name の再取得に失敗しました');
    }
  };

  if (loading) return <div className="export-page"><p>読み込み中...</p></div>;

  return (
    <div className="export-page">
      <div className="page-header">
        <h2>チャンネルデータ ダウンロード</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

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

      {metadata && (
        <div className="export-section">
          <div className="metadata-header">
            <h3>Project / User 設定</h3>
            <div className="metadata-actions">
              <button className="btn btn-secondary btn-sm" onClick={handleRefreshDisplayNames}>
                display_name再取得
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveMetadata}>
                設定を保存
              </button>
            </div>
          </div>

          <div className="metadata-group">
            <h4>Projects</h4>
            <div className="metadata-add-form">
              <input
                type="text"
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
                placeholder="project_id"
              />
              <input
                type="text"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="name"
              />
              <input
                type="text"
                value={newProjectChannels}
                onChange={e => setNewProjectChannels(e.target.value)}
                placeholder="target_channel_ids (C01..., C02...)"
              />
              <input
                type="text"
                value={newProjectKeywords}
                onChange={e => setNewProjectKeywords(e.target.value)}
                placeholder="keywords (foo, bar)"
              />
              <button className="btn btn-secondary btn-sm" onClick={handleAddProject}>追加</button>
            </div>

            <div className="metadata-list">
              {metadata.projects.map((project, index) => (
                <div key={`project-${index}`} className="metadata-item">
                  <div className="metadata-grid">
                    <input
                      type="text"
                      value={project.project_id}
                      onChange={e => updateProject(index, item => ({ ...item, project_id: e.target.value }))}
                      placeholder="project_id"
                    />
                    <input
                      type="text"
                      value={project.name}
                      onChange={e => updateProject(index, item => ({ ...item, name: e.target.value }))}
                      placeholder="name"
                    />
                    <input
                      type="text"
                      value={toCsv(project.target_channel_ids)}
                      onChange={e => updateProject(index, item => ({ ...item, target_channel_ids: parseCsv(e.target.value) }))}
                      placeholder="target_channel_ids"
                    />
                    <input
                      type="text"
                      value={toCsv(project.keywords)}
                      onChange={e => updateProject(index, item => ({ ...item, keywords: parseCsv(e.target.value) }))}
                      placeholder="keywords"
                    />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteProject(index)}>削除</button>
                </div>
              ))}
              {metadata.projects.length === 0 && (
                <div className="empty-state"><p>Project定義がありません</p></div>
              )}
            </div>
          </div>

          <div className="metadata-group">
            <h4>Users</h4>
            <div className="metadata-add-form users">
              <input
                type="text"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                placeholder="user_id (U01...)"
              />
              <input
                type="text"
                value={newUserDisplayName}
                onChange={e => setNewUserDisplayName(e.target.value)}
                placeholder="display_name"
              />
              <button className="btn btn-secondary btn-sm" onClick={handleAddUser}>追加</button>
            </div>

            <div className="metadata-list">
              {metadata.users.map((user, index) => (
                <div key={`user-${index}`} className="metadata-item">
                  <div className="metadata-grid users">
                    <input
                      type="text"
                      value={user.user_id}
                      onChange={e => updateUser(index, item => ({ ...item, user_id: e.target.value }))}
                      placeholder="user_id"
                    />
                    <input
                      type="text"
                      value={user.display_name}
                      onChange={e => updateUser(index, item => ({ ...item, display_name: e.target.value }))}
                      placeholder="display_name"
                    />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteUser(index)}>削除</button>
                </div>
              ))}
              {metadata.users.length === 0 && (
                <div className="empty-state"><p>User定義がありません</p></div>
              )}
            </div>
          </div>
        </div>
      )}

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
