import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Thread } from '../types';
import { tagsApi } from '../lib/api';
import TagManagementModal from './TagManagementModal';
import './ThreadEditModal.css';

interface ThreadEditModalProps {
  thread: Thread;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    tags: string[];
    summary_topic: string;
  }) => Promise<void>;
  onGenerateSummary: () => Promise<void>;
}

export const ThreadEditModal: React.FC<ThreadEditModalProps> = ({
  thread,
  isOpen,
  onClose,
  onSave,
  onGenerateSummary,
}) => {
  const [title, setTitle] = useState(thread.title);
  const [tags, setTags] = useState<string[]>(thread.tags);
  const [summaryTopic, setSummaryTopic] = useState(thread.summary.topic || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);

  // タグ一覧取得
  const { data: availableTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getTags,
    enabled: isOpen,
  });

  // スレッドが変更されたら状態を更新
  useEffect(() => {
    if (isOpen) {
      setTitle(thread.title);
      setTags(thread.tags);
      setSummaryTopic(thread.summary.topic || '');
    }
  }, [isOpen, thread]);

  const handleTagToggle = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        title,
        tags,
        summary_topic: summaryTopic,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save thread:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSummary();
      // 生成後、スレッドデータが更新されるのでuseEffectで自動的に反映される
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('要約の生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>スレッドを編集</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* タイトル */}
          <div className="form-group">
            <label htmlFor="thread-title">タイトル</label>
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
              <label>タグ</label>
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

          {/* 要約 */}
          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="thread-summary">要約</label>
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={isGenerating || thread.message_count === 0}
                className="btn btn-secondary btn-sm"
                title={thread.message_count === 0 ? 'メッセージがないため要約を生成できません' : ''}
              >
                {isGenerating ? 'AI生成中...' : 'AIで生成'}
              </button>
            </div>
            {thread.message_count === 0 && (
              <div className="warning-message">
                このスレッドにはメッセージがありません。Slackから同期してください。
              </div>
            )}
            <textarea
              id="thread-summary"
              value={summaryTopic}
              onChange={(e) => setSummaryTopic(e.target.value)}
              className="form-textarea"
              placeholder="スレッドの要約を入力（AIで自動生成も可能）"
              rows={4}
            />
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
            {isSaving ? '保存中...' : '保存'}
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
