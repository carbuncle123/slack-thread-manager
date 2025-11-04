import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '../lib/api';
import './TagManagementModal.css';

interface TagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TagManagementModal({ isOpen, onClose }: TagManagementModalProps) {
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // タグ一覧取得
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getTags,
    enabled: isOpen,
  });

  // タグ作成
  const createMutation = useMutation({
    mutationFn: tagsApi.createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'タグの作成に失敗しました');
    },
  });

  // タグ更新
  const updateMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      tagsApi.updateTag(oldName, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingTag(null);
      setEditedName('');
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'タグの更新に失敗しました');
    },
  });

  // タグ削除
  const deleteMutation = useMutation({
    mutationFn: tagsApi.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'タグの削除に失敗しました');
    },
  });

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createMutation.mutate(newTagName.trim());
  };

  const handleUpdateTag = (oldName: string) => {
    if (!editedName.trim()) return;
    updateMutation.mutate({ oldName, newName: editedName.trim() });
  };

  const handleDeleteTag = (tagName: string) => {
    if (window.confirm(`タグ「${tagName}」を削除してもよろしいですか？`)) {
      deleteMutation.mutate(tagName);
    }
  };

  const startEditing = (tagName: string) => {
    setEditingTag(tagName);
    setEditedName(tagName);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditedName('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="tag-modal-overlay" onClick={onClose}>
      <div className="tag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tag-modal-header">
          <h2>タグ管理</h2>
          <button className="tag-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tag-modal-content">
          {error && <div className="tag-error">{error}</div>}

          {/* 新規タグ作成フォーム */}
          <form onSubmit={handleCreateTag} className="tag-create-form">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="新しいタグ名"
              className="tag-input"
            />
            <button
              type="submit"
              className="tag-btn tag-btn-primary"
              disabled={!newTagName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '作成中...' : '追加'}
            </button>
          </form>

          {/* タグ一覧 */}
          {isLoading ? (
            <div className="tag-loading">読み込み中...</div>
          ) : (
            <div className="tag-list">
              {tags.length === 0 ? (
                <div className="tag-empty">タグがありません</div>
              ) : (
                tags.map((tag) => (
                  <div key={tag} className="tag-item">
                    {editingTag === tag ? (
                      // 編集モード
                      <div className="tag-edit-form">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="tag-input"
                          autoFocus
                        />
                        <button
                          className="tag-btn tag-btn-success"
                          onClick={() => handleUpdateTag(tag)}
                          disabled={!editedName.trim() || updateMutation.isPending}
                        >
                          保存
                        </button>
                        <button
                          className="tag-btn tag-btn-secondary"
                          onClick={cancelEditing}
                          disabled={updateMutation.isPending}
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      // 表示モード
                      <>
                        <span className="tag-name">{tag}</span>
                        <div className="tag-actions">
                          <button
                            className="tag-btn tag-btn-sm tag-btn-edit"
                            onClick={() => startEditing(tag)}
                          >
                            編集
                          </button>
                          <button
                            className="tag-btn tag-btn-sm tag-btn-danger"
                            onClick={() => handleDeleteTag(tag)}
                            disabled={deleteMutation.isPending}
                          >
                            削除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="tag-modal-footer">
          <button className="tag-btn tag-btn-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
