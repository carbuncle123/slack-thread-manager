import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { threadsApi, viewsApi } from '../lib/api';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
import { ViewSelector } from '../components/ViewSelector';
import { Pagination } from '../components/Pagination';
import type { Thread, ThreadView } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';
import './ThreadListPage.css';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export default function ArchivedThreadsPage() {
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

  // React Query クライアント
  const queryClient = useQueryClient();

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
      is_archived: true, // アーカイブ済みのみ表示
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

  // スレッド一覧を取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['archived-threads', apiParams],
    queryFn: () => threadsApi.getThreads(apiParams),
  });

  // 全件取得用クエリ（タグ抽出用）
  const { data: allArchivedData } = useQuery({
    queryKey: ['all-archived-threads-for-tags'],
    queryFn: () => threadsApi.getThreads({ limit: 10000, offset: 0, is_archived: true }),
    staleTime: 5 * 60 * 1000,
  });

  // 利用可能なタグを収集（全件から抽出）
  const availableTags = useMemo(() => {
    if (!allArchivedData?.threads) {
      return [];
    }
    const tagSet = new Set<string>();
    allArchivedData.threads.forEach(thread => {
      thread.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allArchivedData]);

  // アーカイブ解除ハンドラー
  const handleUnarchiveClick = async (threadId: string) => {
    if (!window.confirm('このスレッドをアーカイブ解除しますか？')) {
      return;
    }

    try {
      await threadsApi.unarchiveThread(threadId);
      // すべてのスレッド関連のクエリを無効化
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['archived-threads'] });
      queryClient.invalidateQueries({ queryKey: ['all-threads-for-tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-archived-threads-for-tags'] });
    } catch (err) {
      console.error('Unarchive failed:', err);
      alert('アーカイブ解除に失敗しました');
    }
  };

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
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
    setCurrentPage(1); // タグ変更時は最初のページに戻る
  };

  const handleStatusChange = (status: 'all' | 'read' | 'unread') => {
    setSelectedStatus(status);
    setShowStatusDropdown(false);
    setCurrentPage(1); // ステータス変更時は最初のページに戻る
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

    setCurrentPage(1); // ビュー変更時は最初のページに戻る
  };

  const threads = data?.threads || [];
  const total = data?.total || 0;

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

  return (
    <div className="thread-list-page">
      <div className="page-header-section">
        <Link to="/" className="back-link">
          ← スレッド一覧に戻る
        </Link>
        <h1 className="page-title">アーカイブ済みスレッド</h1>
      </div>

      {/* ビュー選択 */}
      <div className="view-controls">
        <ViewSelector
          views={views}
          selectedViewId={selectedViewId}
          onSelectView={handleSelectView}
          showCreateButton={false}
          showManageButton={false}
        />
      </div>

      {/* フィルターパネル */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* スレッドテーブル */}
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
                    <p>条件に一致するアーカイブ済みスレッドがありません</p>
                  </div>
                </td>
              </tr>
            ) : (
              threads.map((thread: Thread) => (
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
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        Slack
                      </a>
                      <button
                        onClick={() => handleUnarchiveClick(thread.id)}
                        className="btn btn-sm btn-success"
                      >
                        解除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <Pagination
        currentPage={currentPage}
        totalItems={total}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
