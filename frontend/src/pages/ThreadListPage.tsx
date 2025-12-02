import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { threadsApi, summariesApi, viewsApi, configApi } from '../lib/api';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
import { Pagination } from '../components/Pagination';
import { ThreadEditModal } from '../components/ThreadEditModal';
import { ThreadCreateModal } from '../components/ThreadCreateModal';
import { ViewSelector } from '../components/ViewSelector';
import { ViewFormModal } from '../components/ViewFormModal';
import { ViewManagementModal } from '../components/ViewManagementModal';
import { SlackCredentialsModal } from '../components/SlackCredentialsModal';
import type { Thread, ViewFilters, ViewSort, ThreadView } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';
import './ThreadListPage.css';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export default function ThreadListPage() {
  // ビュー選択状態
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  // フィルター状態
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  // テーブルヘッダーフィルター
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'read' | 'unread'>('all');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // ソート状態
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 編集モーダル状態
  const [editingThread, setEditingThread] = useState<Thread | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 新規作成モーダル状態
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ビュー管理モーダル状態
  const [isViewManagementModalOpen, setIsViewManagementModalOpen] = useState(false);
  const [isViewFormModalOpen, setIsViewFormModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<ThreadView | null>(null);

  // Slack認証情報モーダル状態
  const [isSlackCredentialsModalOpen, setIsSlackCredentialsModalOpen] = useState(false);

  // React Query クライアント
  const queryClient = useQueryClient();

  // 設定を取得（Slack認証情報表示用）
  const { data: appConfig } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.getConfig(),
  });

  // ビュー一覧を取得
  const { data: views = [] } = useQuery({
    queryKey: ['views'],
    queryFn: () => viewsApi.getViews(),
  });

  // APIパラメータを構築
  const apiParams = useMemo(() => {
    const params: any = {
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      is_archived: false, // アーカイブ済みは除外
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (selectedTags.length > 0) {
      params.tags = selectedTags.join(',');
    }

    if (selectedStatus !== 'all') {
      params.is_read = selectedStatus === 'read';
    }

    if (filters.dateFrom) {
      params.date_from = filters.dateFrom;
    }

    if (filters.dateTo) {
      params.date_to = filters.dateTo;
    }

    return params;
  }, [filters, selectedTags, selectedStatus, sortBy, sortOrder, currentPage, itemsPerPage]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['threads', apiParams],
    queryFn: () => threadsApi.getThreads(apiParams),
  });

  // 全件取得用クエリ（フィルタなし、タグ抽出用）
  const { data: allThreadsData } = useQuery({
    queryKey: ['all-threads-for-tags'],
    queryFn: () => threadsApi.getThreads({ limit: 10000, offset: 0, is_archived: false }),
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  // 利用可能なタグを収集（全件から抽出）
  const availableTags = useMemo(() => {
    if (!allThreadsData?.threads) {
      return [];
    }
    const tagSet = new Set<string>();
    allThreadsData.threads.forEach(thread => {
      thread.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allThreadsData]);

  const handleSyncAll = async () => {
    try {
      await threadsApi.syncAll();
      refetch();
      // タグ選択肢も最新にする
      queryClient.invalidateQueries({ queryKey: ['all-threads-for-tags'] });
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      // 同じカラムをクリックしたら、順序を反転
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 新しいカラムをクリックしたら、そのカラムで降順ソート
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1); // ソート変更時は最初のページに戻る
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1); // フィルター変更時は最初のページに戻る
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const handleStatusChange = (status: 'all' | 'read' | 'unread') => {
    setSelectedStatus(status);
    setShowStatusDropdown(false);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // 編集モーダル操作
  const handleEditClick = (thread: Thread) => {
    setEditingThread(thread);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingThread(null);
  };

  const handleEditSave = async (updates: {
    title: string;
    tags: string[];
    summary_topic: string;
  }) => {
    if (!editingThread) return;

    await threadsApi.updateThread(editingThread.id, updates);
    await refetch();
    // タグが変更された可能性があるのでタグ選択肢も更新
    queryClient.invalidateQueries({ queryKey: ['all-threads-for-tags'] });
  };

  const handleGenerateSummary = async () => {
    if (!editingThread) return;

    await summariesApi.generateSummary(editingThread.id, true);
    // 生成後、スレッドデータを再取得
    await refetch();
    // モーダルの表示を更新するため、editingThreadを更新（新しいオブジェクトとして）
    const updatedThread = await threadsApi.getThread(editingThread.id);
    setEditingThread({ ...updatedThread });
  };

  // 新規作成モーダル操作
  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSave = async (data: {
    channel_id: string;
    thread_ts: string;
    title: string;
    tags: string[];
  }) => {
    await threadsApi.createThread(data);
    await refetch();
    // タグが追加された可能性があるのでタグ選択肢も更新
    queryClient.invalidateQueries({ queryKey: ['all-threads-for-tags'] });
    setCurrentPage(1); // 最初のページに戻る
  };

  // アーカイブ操作
  const handleArchiveClick = async (threadId: string) => {
    if (!window.confirm('このスレッドをアーカイブしますか？')) {
      return;
    }

    try {
      await threadsApi.archiveThread(threadId);
      // すべてのスレッド関連のクエリを無効化
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['archived-threads'] });
      queryClient.invalidateQueries({ queryKey: ['all-threads-for-tags'] });
    } catch (err) {
      console.error('Archive failed:', err);
      alert('アーカイブに失敗しました');
    }
  };

  // ビュー選択ハンドラ
  const handleSelectView = (viewId: string | null) => {
    setSelectedViewId(viewId);

    if (viewId === null) {
      // 「すべてのスレッド」を選択 - フィルタをリセット
      setFilters({ search: '', dateFrom: '', dateTo: '' });
      setSelectedTags([]);
      setSelectedStatus('all');
      setSortBy('updated_at');
      setSortOrder('desc');
    } else {
      // ビューのフィルタ条件を適用
      const view = views.find(v => v.id === viewId);
      if (view) {
        setFilters({
          search: view.filters.search,
          dateFrom: view.filters.date_from || '',
          dateTo: view.filters.date_to || '',
        });
        setSelectedTags(view.filters.tags);
        setSelectedStatus(
          view.filters.is_read === null ? 'all' :
          view.filters.is_read ? 'read' : 'unread'
        );
        setSortBy(view.sort.sort_by);
        setSortOrder(view.sort.sort_order);
      }
    }

    setCurrentPage(1); // 最初のページに戻る
  };

  // ビュー管理モーダル操作
  const handleViewManagementClick = () => {
    setIsViewManagementModalOpen(true);
  };

  const handleViewCreate = () => {
    setEditingView(null);
    setIsViewFormModalOpen(true);
  };

  const handleViewEdit = (view: ThreadView) => {
    setEditingView(view);
    setIsViewManagementModalOpen(false);
    setIsViewFormModalOpen(true);
  };

  const handleViewFormSave = async (data: {
    name: string;
    description: string | null;
    is_default: boolean;
    filters: ViewFilters;
    sort: ViewSort;
  }) => {
    if (editingView) {
      // 更新
      await viewsApi.updateView(editingView.id, data);
    } else {
      // 新規作成
      await viewsApi.createView(data);
    }
    // ビュー一覧を再取得
    queryClient.invalidateQueries({ queryKey: ['views'] });
  };

  const handleViewDelete = async (viewId: string) => {
    await viewsApi.deleteView(viewId);
    // 削除したビューが選択中だった場合、選択を解除
    if (selectedViewId === viewId) {
      setSelectedViewId(null);
    }
    // ビュー一覧を再取得
    queryClient.invalidateQueries({ queryKey: ['views'] });
  };

  const handleViewToggleDefault = async (viewId: string, isDefault: boolean) => {
    await viewsApi.setDefault(viewId, { is_default: isDefault });
    // ビュー一覧を再取得
    queryClient.invalidateQueries({ queryKey: ['views'] });
  };

  // 現在のフィルタとソートをViewFilters/ViewSort形式に変換
  const currentViewFilters: ViewFilters = useMemo(() => ({
    tags: selectedTags,
    is_read: selectedStatus === 'all' ? null : selectedStatus === 'read',
    search: filters.search,
    date_from: filters.dateFrom || null,
    date_to: filters.dateTo || null,
    has_new_messages: false,
  }), [selectedTags, selectedStatus, filters]);

  const currentViewSort: ViewSort = useMemo(() => ({
    sort_by: sortBy,
    sort_order: sortOrder,
  }), [sortBy, sortOrder]);

  // ドロップダウンを外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filterable')) {
        setShowTagDropdown(false);
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (isLoading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="error">
        エラーが発生しました: {error instanceof Error ? error.message : '不明なエラー'}
      </div>
    );
  }

  const threads = data?.threads || [];
  const total = data?.total || 0;

  return (
    <div className="thread-list-page">
      <div className="page-header">
        <h2>スレッド一覧</h2>
        <div className="actions">
          <button
            onClick={() => setIsSlackCredentialsModalOpen(true)}
            className="btn btn-secondary"
            title="Slack認証情報を設定"
          >
            ⚙️ Slack設定
          </button>
          <button onClick={handleCreateClick} className="btn btn-primary">
            新規スレッド追加
          </button>
          <Link to="/discover" className="btn btn-secondary">
            新規スレッド発見
          </Link>
          <button onClick={handleSyncAll} className="btn btn-secondary">
            全スレッド同期
          </button>
        </div>
      </div>

      {/* ビュー選択 */}
      <div className="view-controls">
        <ViewSelector
          views={views}
          selectedViewId={selectedViewId}
          onSelectView={handleSelectView}
          currentFilters={currentViewFilters}
          currentSort={currentViewSort}
        />
        <div className="view-actions">
          <button onClick={handleViewCreate} className="btn btn-sm btn-secondary">
            現在の条件で新規ビュー作成
          </button>
          <button onClick={handleViewManagementClick} className="btn btn-sm btn-secondary">
            ビュー管理
          </button>
        </div>
      </div>

      {/* フィルターパネル */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* 結果サマリー */}
      <div className="results-summary">
        <p>{total} 件のスレッドが見つかりました</p>
      </div>

      {/* スレッドテーブル（常に表示） */}
      <div className="thread-table-container">
        <table className="thread-table">
          <thead>
            <tr>
              <th onClick={() => handleSortChange('title')} className="sortable">
                タイトル
                {sortBy === 'title' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
              <th>要約</th>
              <th onClick={() => handleSortChange('message_count')} className="sortable">
                メッセージ数
                {sortBy === 'message_count' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSortChange('updated_at')} className="sortable">
                最終更新
                {sortBy === 'updated_at' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                  </span>
                )}
              </th>
              <th className="filterable">
                <div className="header-with-filter">
                  <span>ステータス</span>
                  <button
                    className="filter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStatusDropdown(!showStatusDropdown);
                      setShowTagDropdown(false);
                    }}
                  >
                    ▼
                  </button>
                  {showStatusDropdown && (
                    <div className="filter-dropdown">
                      <label className="filter-option">
                        <input
                          type="radio"
                          checked={selectedStatus === 'all'}
                          onChange={() => handleStatusChange('all')}
                        />
                        <span>すべて</span>
                      </label>
                      <label className="filter-option">
                        <input
                          type="radio"
                          checked={selectedStatus === 'unread'}
                          onChange={() => handleStatusChange('unread')}
                        />
                        <span>未読</span>
                      </label>
                      <label className="filter-option">
                        <input
                          type="radio"
                          checked={selectedStatus === 'read'}
                          onChange={() => handleStatusChange('read')}
                        />
                        <span>既読</span>
                      </label>
                    </div>
                  )}
                </div>
              </th>
              <th className="filterable">
                <div className="header-with-filter">
                  <span>タグ</span>
                  <button
                    className="filter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTagDropdown(!showTagDropdown);
                      setShowStatusDropdown(false);
                    }}
                  >
                    ▼
                  </button>
                  {showTagDropdown && (
                    <div className="filter-dropdown">
                      {availableTags.length === 0 ? (
                        <div className="no-options">タグがありません</div>
                      ) : (
                        availableTags.map(tag => (
                          <label key={tag} className="filter-option">
                            <input
                              type="checkbox"
                              checked={selectedTags.includes(tag)}
                              onChange={() => handleTagToggle(tag)}
                            />
                            <span>{tag}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </th>
              <th>アクション</th>
            </tr>
          </thead>
          <tbody>
            {threads.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state-cell">
                  <div className="empty-state">
                    <p>条件に一致するスレッドがありません</p>
                  </div>
                </td>
              </tr>
            ) : (
              threads.map((thread) => (
                <tr key={thread.id} className={!thread.is_read ? 'unread' : ''}>
                  <td>
                    <Link to={`/threads/${thread.id}`} className="thread-title-link">
                      {thread.title}
                    </Link>
                    {!thread.is_read && thread.new_message_count > 0 && (
                      <span className="badge badge-danger">
                        +{thread.new_message_count}
                      </span>
                    )}
                  </td>
                  <td className="thread-summary-cell">
                    {thread.summary.topic || '-'}
                  </td>
                  <td className="text-center">{thread.message_count}</td>
                  <td>{dayjs(thread.updated_at).fromNow()}</td>
                  <td className="text-center">
                    <span className={`status-badge ${thread.is_read ? 'read' : 'unread'}`}>
                      {thread.is_read ? '既読' : '未読'}
                    </span>
                  </td>
                  <td>
                    <div className="thread-tags">
                      {thread.tags.map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditClick(thread)}
                        className="btn btn-sm btn-secondary"
                      >
                        編集
                      </button>
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        Slack
                      </a>
                      <button
                        onClick={() => handleArchiveClick(thread.id)}
                        className="btn btn-sm btn-warning"
                      >
                        アーカイブ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション（スレッドがある場合のみ） */}
      {threads.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={total}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}

      {/* 編集モーダル */}
      {editingThread && (
        <ThreadEditModal
          thread={editingThread}
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          onSave={handleEditSave}
          onGenerateSummary={handleGenerateSummary}
        />
      )}

      {/* 新規作成モーダル */}
      <ThreadCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateSave}
      />

      {/* ビュー作成/編集モーダル */}
      <ViewFormModal
        isOpen={isViewFormModalOpen}
        onClose={() => {
          setIsViewFormModalOpen(false);
          setEditingView(null);
        }}
        onSave={handleViewFormSave}
        editingView={editingView}
        currentFilters={currentViewFilters}
        currentSort={currentViewSort}
      />

      {/* ビュー管理モーダル */}
      <ViewManagementModal
        isOpen={isViewManagementModalOpen}
        onClose={() => setIsViewManagementModalOpen(false)}
        views={views}
        onEdit={handleViewEdit}
        onDelete={handleViewDelete}
        onToggleDefault={handleViewToggleDefault}
      />

      {/* Slack認証情報モーダル */}
      <SlackCredentialsModal
        isOpen={isSlackCredentialsModalOpen}
        onClose={() => setIsSlackCredentialsModalOpen(false)}
        currentXoxcToken={appConfig?.slack.xoxc_token}
        currentCookie={appConfig?.slack.cookie}
      />
    </div>
  );
}
