import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tagsApi } from '../lib/api';
import TagManagementModal from './TagManagementModal';
import './ThreadCreateModal.css';

interface ThreadCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    channel_id: string;
    thread_ts: string;
    title: string;
    tags: string[];
  }) => Promise<void>;
}

export const ThreadCreateModal: React.FC<ThreadCreateModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [slackUrl, setSlackUrl] = useState('');
  const [channelId, setChannelId] = useState('');
  const [threadTs, setThreadTs] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);

  // タグ一覧取得
  const { data: availableTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getTags,
    enabled: isOpen,
  });

  // モーダルが開いたらフォームをリセット
  useEffect(() => {
    if (isOpen) {
      setSlackUrl('');
      setChannelId('');
      setThreadTs('');
      setTitle('');
      setTags([]);
      setError('');
    }
  }, [isOpen]);

  // SlackのURLをパースする関数
  const parseSlackUrl = (url: string): { channelId: string; threadTs: string } | null => {
    try {
      // Slack URL形式: https://[workspace].slack.com/archives/[CHANNEL_ID]/p[TIMESTAMP]
      // 例: https://myworkspace.slack.com/archives/C01G1P9CCDB/p1234567890123456
      const match = url.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
      if (match) {
        const channelId = match[1];
        const timestamp = match[2];
        // タイムスタンプを変換: 1234567890123456 -> 1234567890.123456
        const threadTs = timestamp.slice(0, 10) + '.' + timestamp.slice(10);
        return { channelId, threadTs };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // URLが変更されたら自動的にパース
  const handleUrlChange = (url: string) => {
    setSlackUrl(url);
    setError('');

    if (url.trim()) {
      const parsed = parseSlackUrl(url);
      if (parsed) {
        setChannelId(parsed.channelId);
        setThreadTs(parsed.threadTs);
      } else {
        setError('有効なSlackスレッドURLを入力してください');
      }
    } else {
      setChannelId('');
      setThreadTs('');
    }
  };

  const handleTagToggle = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const validateForm = (): boolean => {
    if (!slackUrl.trim()) {
      setError('SlackスレッドURLを入力してください');
      return false;
    }
    if (!channelId.trim() || !threadTs.trim()) {
      setError('有効なSlackスレッドURLを入力してください');
      return false;
    }
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave({
        channel_id: channelId.trim(),
        thread_ts: threadTs.trim(),
        title: title.trim(),
        tags,
      });
      onClose();
    } catch (error: any) {
      console.error('Failed to create thread:', error);
      setError(error.response?.data?.detail || '新規スレッドの作成に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新規スレッド追加</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* SlackスレッドURL */}
          <div className="form-group">
            <label htmlFor="slack-url">
              SlackスレッドURL <span className="required">*</span>
            </label>
            <input
              id="slack-url"
              type="text"
              value={slackUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="form-input"
              placeholder="例: https://myworkspace.slack.com/archives/C01G1P9CCDB/p1234567890123456"
            />
            <small className="form-hint">
              Slackのスレッドから「リンクをコピー」で取得できます
            </small>
          </div>

          {/* 自動抽出された情報 */}
          {channelId && threadTs && (
            <div className="form-group">
              <div className="parsed-info">
                <div className="parsed-info-item">
                  <strong>チャンネルID:</strong> {channelId}
                </div>
                <div className="parsed-info-item">
                  <strong>タイムスタンプ:</strong> {threadTs}
                </div>
              </div>
            </div>
          )}

          {/* タイトル */}
          <div className="form-group">
            <label htmlFor="thread-title">
              タイトル <span className="required">*</span>
            </label>
            <input
              id="thread-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              placeholder="スレッドのタイトル"
            />
          </div>

          {/* タグ */}
          <div className="form-group">
            <div className="form-group-header">
              <label>タグ（任意）</label>
              <button
                type="button"
                onClick={() => setIsTagManagementOpen(true)}
                className="btn btn-secondary btn-sm"
              >
                タグ管理
              </button>
            </div>
            <div className="tag-checkbox-container">
              {availableTags.length === 0 ? (
                <div className="tag-empty-message">
                  タグがありません。「タグ管理」ボタンからタグを追加してください。
                </div>
              ) : (
                availableTags.map((tag) => (
                  <label key={tag} className="tag-checkbox-label">
                    <input
                      type="checkbox"
                      checked={tags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="tag-checkbox"
                    />
                    <span>{tag}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSaving}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? '作成中...' : '作成'}
          </button>
        </div>
      </div>

      {/* タグ管理モーダル */}
      <TagManagementModal
        isOpen={isTagManagementOpen}
        onClose={() => setIsTagManagementOpen(false)}
      />
    </div>
  );
};
