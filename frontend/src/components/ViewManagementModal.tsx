import React, { useState } from 'react';
import type { ThreadView } from '../types';
import './ViewManagementModal.css';

interface ViewManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: ThreadView[];
  onEdit: (view: ThreadView) => void;
  onDelete: (viewId: string) => Promise<void>;
  onToggleDefault: (viewId: string, isDefault: boolean) => Promise<void>;
}

export const ViewManagementModal: React.FC<ViewManagementModalProps> = ({
  isOpen,
  onClose,
  views,
  onEdit,
  onDelete,
  onToggleDefault,
}) => {
  const [deletingViewId, setDeletingViewId] = useState<string | null>(null);
  const [togglingViewId, setTogglingViewId] = useState<string | null>(null);

  const handleDelete = async (viewId: string, viewName: string) => {
    if (!window.confirm(`ビュー「${viewName}」を削除してもよろしいですか？`)) {
      return;
    }

    setDeletingViewId(viewId);
    try {
      await onDelete(viewId);
    } catch (error) {
      console.error('Failed to delete view:', error);
      alert('ビューの削除に失敗しました');
    } finally {
      setDeletingViewId(null);
    }
  };

  const handleToggleDefault = async (view: ThreadView) => {
    setTogglingViewId(view.id);
    try {
      await onToggleDefault(view.id, !view.is_default);
    } catch (error) {
      console.error('Failed to toggle default view:', error);
      alert('デフォルトビューの設定に失敗しました');
    } finally {
      setTogglingViewId(null);
    }
  };

  const getFilterSummary = (view: ThreadView): string[] => {
    const summary: string[] = [];

    if (view.filters.tags.length > 0) {
      summary.push(`タグ: [${view.filters.tags.join(', ')}]`);
    }

    if (view.filters.is_read !== null) {
      summary.push(`ステータス: ${view.filters.is_read ? '既読' : '未読'}`);
    }

    if (view.filters.search) {
      summary.push(`検索: "${view.filters.search}"`);
    }

    if (view.filters.date_from || view.filters.date_to) {
      summary.push('期間指定あり');
    }

    if (view.filters.has_new_messages) {
      summary.push('新着メッセージあり');
    }

    if (summary.length === 0) {
      summary.push('フィルタなし');
    }

    return summary;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content view-management-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ビュー管理</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="views-count">
            保存済みビュー ({views.length}件)
          </div>

          {views.length === 0 ? (
            <div className="empty-views">
              <p>保存されているビューがありません</p>
              <p className="empty-hint">
                スレッド一覧画面でフィルタ条件を設定し、「現在の条件で新規ビュー作成」を選択してビューを作成できます
              </p>
            </div>
          ) : (
            <div className="views-list">
              {views.map((view) => (
                <div key={view.id} className="view-item">
                  <div className="view-item-header">
                    <h3>
                      {view.is_default && <span className="default-badge">★</span>}
                      {view.name}
                    </h3>
                  </div>

                  {view.description && (
                    <p className="view-description">{view.description}</p>
                  )}

                  <div className="view-filters">
                    {getFilterSummary(view).map((filter, index) => (
                      <span key={index} className="filter-tag">
                        {filter}
                      </span>
                    ))}
                  </div>

                  <div className="view-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => onEdit(view)}
                      disabled={deletingViewId === view.id || togglingViewId === view.id}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleToggleDefault(view)}
                      disabled={deletingViewId === view.id || togglingViewId === view.id}
                    >
                      {togglingViewId === view.id
                        ? '処理中...'
                        : view.is_default
                        ? 'デフォルト解除'
                        : 'デフォルトに設定'}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(view.id, view.name)}
                      disabled={deletingViewId === view.id || togglingViewId === view.id}
                    >
                      {deletingViewId === view.id ? '削除中...' : '削除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
