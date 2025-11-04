import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MonitoredChannel } from '../types';
import { configApi } from '../lib/api';
import './ChannelManagementModal.css';

interface ChannelManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: MonitoredChannel[];
  onAdd: (channel: MonitoredChannel) => Promise<void>;
  onUpdate: (channelId: string, channel: MonitoredChannel) => Promise<void>;
  onDelete: (channelId: string) => Promise<void>;
}

export const ChannelManagementModal: React.FC<ChannelManagementModalProps> = ({
  isOpen,
  onClose,
  channels,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [editingChannel, setEditingChannel] = useState<MonitoredChannel | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<MonitoredChannel>({
    channel_id: '',
    channel_name: '',
    mention_users: [],
    keywords: [],
  });
  const [mentionUserInput, setMentionUserInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [defaultMentionUserInput, setDefaultMentionUserInput] = useState('');

  const queryClient = useQueryClient();

  // デフォルトメンションユーザー取得
  const { data: defaultMentionUsers = [] } = useQuery({
    queryKey: ['defaultMentionUsers'],
    queryFn: configApi.getDefaultMentionUsers,
    enabled: isOpen,
  });

  // デフォルトメンションユーザー更新
  const updateDefaultMentionMutation = useMutation({
    mutationFn: configApi.updateDefaultMentionUsers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defaultMentionUsers'] });
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setIsAdding(false);
      setEditingChannel(null);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      channel_id: '',
      channel_name: '',
      mention_users: [],
      keywords: [],
    });
    setMentionUserInput('');
    setKeywordInput('');
    setError('');
  };

  const handleEdit = (channel: MonitoredChannel) => {
    setEditingChannel(channel);
    setFormData({ ...channel });
    setIsAdding(false);
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingChannel(null);
    resetForm();
    // デフォルトメンションユーザーをセット
    setFormData({
      channel_id: '',
      channel_name: '',
      mention_users: [...defaultMentionUsers],
      keywords: [],
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingChannel(null);
    resetForm();
  };

  const handleAddMentionUser = () => {
    const userId = mentionUserInput.trim();
    if (userId && !formData.mention_users.includes(userId)) {
      setFormData({
        ...formData,
        mention_users: [...formData.mention_users, userId],
      });
      setMentionUserInput('');
    }
  };

  const handleRemoveMentionUser = (userId: string) => {
    setFormData({
      ...formData,
      mention_users: formData.mention_users.filter(u => u !== userId),
    });
  };

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim();
    if (keyword && !formData.keywords.includes(keyword)) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keyword],
      });
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword),
    });
  };

  const handleAddDefaultMentionUser = () => {
    const userId = defaultMentionUserInput.trim();
    if (userId && !defaultMentionUsers.includes(userId)) {
      updateDefaultMentionMutation.mutate([...defaultMentionUsers, userId]);
      setDefaultMentionUserInput('');
    }
  };

  const handleRemoveDefaultMentionUser = (userId: string) => {
    updateDefaultMentionMutation.mutate(
      defaultMentionUsers.filter(u => u !== userId)
    );
  };

  const validateForm = (): boolean => {
    if (!formData.channel_id.trim()) {
      setError('チャンネルIDを入力してください');
      return false;
    }
    if (!formData.channel_name.trim()) {
      setError('チャンネル名を入力してください');
      return false;
    }
    if (formData.mention_users.length === 0 && formData.keywords.length === 0) {
      setError('メンションユーザーまたはキーワードを少なくとも1つ指定してください');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (isAdding) {
        await onAdd(formData);
      } else if (editingChannel) {
        await onUpdate(editingChannel.channel_id, formData);
      }
      handleCancel();
    } catch (error: any) {
      console.error('Failed to save channel:', error);
      setError(error.response?.data?.detail || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!window.confirm('このチャンネルを削除してもよろしいですか?')) {
      return;
    }

    try {
      await onDelete(channelId);
    } catch (error) {
      console.error('Failed to delete channel:', error);
      alert('削除に失敗しました');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>監視チャンネル管理</h2>
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

          {/* デフォルトメンションユーザー設定 */}
          {!isAdding && !editingChannel && (
            <div className="default-mention-section">
              <h3>デフォルトメンションユーザー設定</h3>
              <p className="section-description">
                新規チャンネル追加時に自動的にセットされるメンションユーザーを設定します。
              </p>
              <div className="form-group">
                <div className="tag-input-container">
                  <input
                    type="text"
                    value={defaultMentionUserInput}
                    onChange={(e) => setDefaultMentionUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDefaultMentionUser())}
                    className="form-input"
                    placeholder="ユーザーID (例: UAGJ7N9EK)"
                  />
                  <button
                    type="button"
                    onClick={handleAddDefaultMentionUser}
                    className="btn btn-secondary btn-sm"
                    disabled={updateDefaultMentionMutation.isPending}
                  >
                    追加
                  </button>
                </div>
                <div className="tag-list">
                  {defaultMentionUsers.map((userId, index) => (
                    <span key={index} className="tag tag-editable">
                      @{userId}
                      <button
                        type="button"
                        onClick={() => handleRemoveDefaultMentionUser(userId)}
                        className="tag-remove-btn"
                        disabled={updateDefaultMentionMutation.isPending}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {defaultMentionUsers.length === 0 && (
                    <span className="empty-hint">デフォルトユーザーが設定されていません</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 追加・編集フォーム */}
          {(isAdding || editingChannel) && (
            <div className="channel-form">
              <h3>{isAdding ? '新規チャンネル追加' : 'チャンネル編集'}</h3>

              <div className="form-group">
                <label htmlFor="channel-id">
                  チャンネルID <span className="required">*</span>
                </label>
                <input
                  id="channel-id"
                  type="text"
                  value={formData.channel_id}
                  onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                  className="form-input"
                  placeholder="例: C01G1P9CCDB"
                  disabled={!isAdding}
                />
              </div>

              <div className="form-group">
                <label htmlFor="channel-name">
                  チャンネル名 <span className="required">*</span>
                </label>
                <input
                  id="channel-name"
                  type="text"
                  value={formData.channel_name}
                  onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                  className="form-input"
                  placeholder="例: general"
                />
              </div>

              <div className="form-group">
                <label>メンションユーザー</label>
                <div className="tag-input-container">
                  <input
                    type="text"
                    value={mentionUserInput}
                    onChange={(e) => setMentionUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMentionUser())}
                    className="form-input"
                    placeholder="ユーザーID (例: UAGJ7N9EK)"
                  />
                  <button
                    type="button"
                    onClick={handleAddMentionUser}
                    className="btn btn-secondary btn-sm"
                  >
                    追加
                  </button>
                </div>
                <div className="tag-list">
                  {formData.mention_users.map((userId, index) => (
                    <span key={index} className="tag tag-editable">
                      @{userId}
                      <button
                        type="button"
                        onClick={() => handleRemoveMentionUser(userId)}
                        className="tag-remove-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>キーワード</label>
                <div className="tag-input-container">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    className="form-input"
                    placeholder="検索キーワード"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="btn btn-secondary btn-sm"
                  >
                    追加
                  </button>
                </div>
                <div className="tag-list">
                  {formData.keywords.map((keyword, index) => (
                    <span key={index} className="tag tag-editable">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="tag-remove-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
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
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}

          {/* チャンネル一覧 */}
          {!isAdding && !editingChannel && (
            <>
              <div className="channel-list-header">
                <h3>登録済みチャンネル</h3>
                <button onClick={handleAddNew} className="btn btn-primary btn-sm">
                  新規追加
                </button>
              </div>

              {channels.length === 0 ? (
                <div className="empty-state">
                  <p>監視チャンネルが登録されていません</p>
                </div>
              ) : (
                <div className="channel-list">
                  {channels.map((channel) => (
                    <div key={channel.channel_id} className="channel-item">
                      <div className="channel-info">
                        <div className="channel-header">
                          <strong>#{channel.channel_name}</strong>
                          <span className="channel-id">{channel.channel_id}</span>
                        </div>
                        <div className="channel-details">
                          {channel.mention_users.length > 0 && (
                            <div className="detail-row">
                              <span className="detail-label">メンション:</span>
                              <div className="tag-list">
                                {channel.mention_users.map((userId, idx) => (
                                  <span key={idx} className="tag">@{userId}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {channel.keywords.length > 0 && (
                            <div className="detail-row">
                              <span className="detail-label">キーワード:</span>
                              <div className="tag-list">
                                {channel.keywords.map((keyword, idx) => (
                                  <span key={idx} className="tag">{keyword}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="channel-actions">
                        <button
                          onClick={() => handleEdit(channel)}
                          className="btn btn-sm btn-secondary"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(channel.channel_id)}
                          className="btn btn-sm btn-danger"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
