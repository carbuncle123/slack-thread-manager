import React, { useState, useEffect } from 'react';
import type { ThreadView, ViewFilters, ViewSort } from '../types';
import './ViewFormModal.css';

interface ViewFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string | null;
    is_default: boolean;
    filters: ViewFilters;
    sort: ViewSort;
  }) => Promise<void>;
  editingView: ThreadView | null;
  currentFilters: ViewFilters;
  currentSort: ViewSort;
}

export const ViewFormModal: React.FC<ViewFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingView,
  currentFilters,
  currentSort,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // モーダルが開かれたとき、または編集対象が変更されたときにフォームを初期化
  useEffect(() => {
    if (isOpen) {
      if (editingView) {
        // 編集モード
        setName(editingView.name);
        setDescription(editingView.description || '');
        setIsDefault(editingView.is_default);
      } else {
        // 新規作成モード
        setName('');
        setDescription('');
        setIsDefault(false);
      }
    }
  }, [isOpen, editingView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('ビュー名を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
        filters: currentFilters,
        sort: currentSort,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save view:', error);
      alert('ビューの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // フィルタ条件のプレビュー表示用テキスト
  const getFilterPreview = () => {
    const items: string[] = [];

    if (currentFilters.tags.length > 0) {
      items.push(`タグ: [${currentFilters.tags.join(', ')}]`);
    }

    if (currentFilters.is_read !== null) {
      items.push(`ステータス: ${currentFilters.is_read ? '既読' : '未読'}`);
    } else {
      items.push('ステータス: すべて');
    }

    if (currentFilters.search) {
      items.push(`検索: "${currentFilters.search}"`);
    }

    if (currentFilters.date_from || currentFilters.date_to) {
      const from = currentFilters.date_from || '指定なし';
      const to = currentFilters.date_to || '指定なし';
      items.push(`期間: ${from} ～ ${to}`);
    }

    if (currentFilters.has_new_messages) {
      items.push('新着メッセージあり');
    }

    const sortLabel = {
      title: 'タイトル',
      message_count: 'メッセージ数',
      updated_at: '最終更新日時',
      created_at: '作成日時',
    }[currentSort.sort_by] || currentSort.sort_by;

    const orderLabel = currentSort.sort_order === 'asc' ? '昇順' : '降順';
    items.push(`ソート: ${sortLabel} (${orderLabel})`);

    return items;
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content view-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingView ? 'ビューを編集' : 'ビューを作成'}</h2>
          <button className="modal-close-btn" onClick={handleClose} disabled={isSaving}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="view-name">
                ビュー名 <span className="required">*</span>
              </label>
              <input
                id="view-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 優先度高タグのスレッド"
                required
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="view-description">説明</label>
              <textarea
                id="view-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="このビューの説明を入力してください（任意）"
                rows={3}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  disabled={isSaving}
                />
                <span>デフォルトビューとして設定</span>
              </label>
              <p className="form-hint">
                デフォルトビューはアプリ起動時に自動的に適用されます
              </p>
            </div>

            <div className="filter-preview">
              <h3>フィルタ条件プレビュー</h3>
              <ul>
                {getFilterPreview().map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
