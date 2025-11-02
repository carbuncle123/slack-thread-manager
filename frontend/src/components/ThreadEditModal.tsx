import React, { useState, useEffect } from 'react';
import type { Thread } from '../types';
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
  const [tagInput, setTagInput] = useState('');
  const [summaryTopic, setSummaryTopic] = useState(thread.summary.topic || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // スレッドが変更されたら状態を更新
  useEffect(() => {
    if (isOpen) {
      setTitle(thread.title);
      setTags(thread.tags);
      setSummaryTopic(thread.summary.topic || '');
    }
  }, [isOpen, thread]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
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
            <label>タグ</label>
            <div className="tag-input-container">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                className="form-input"
                placeholder="タグを入力してEnter"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="btn btn-secondary btn-sm"
              >
                追加
              </button>
            </div>
            <div className="tag-list">
              {tags.map((tag, index) => (
                <span key={index} className="tag tag-editable">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="tag-remove-btn"
                  >
                    ×
                  </button>
                </span>
              ))}
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
    </div>
  );
};
