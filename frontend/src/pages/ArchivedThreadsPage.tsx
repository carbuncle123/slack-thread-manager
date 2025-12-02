import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { threadsApi } from '../lib/api';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
import { Pagination } from '../components/Pagination';
import type { Thread } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';
import './ThreadListPage.css';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export default function ArchivedThreadsPage() {
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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['archived-threads', apiParams],
    queryFn: () => threadsApi.getThreads(apiParams),
  });

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
    } catch (err) {
      console.error('Unarchive failed:', err);
      alert('アーカイブ解除に失敗しました');
    }
  };

  // ソートハンドラー
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
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
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← スレッド一覧に戻る
          </Link>
          <h2>アーカイブ済みスレッド</h2>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={() => setCurrentPage(1)}
      />

      <div className="results-info">
        <span>
          {total}件中 {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, total)}件を表示
        </span>
        <div className="per-page-selector">
          <label htmlFor="items-per-page">表示件数:</label>
          <select
            id="items-per-page"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10件</option>
            <option value={20}>20件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="threads-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort('title')}
                className="sortable"
              >
                タイトル {sortBy === 'title' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th className="filter-header">
                <button
                  className="filter-button"
                  onClick={() => {
                    setShowTagDropdown(!showTagDropdown);
                    setShowStatusDropdown(false);
                  }}
                >
                  タグ {selectedTags.length > 0 && `(${selectedTags.length})`}
                </button>
              </th>
              <th className="filter-header">
                <button
                  className="filter-button"
                  onClick={() => {
                    setShowStatusDropdown(!showStatusDropdown);
                    setShowTagDropdown(false);
                  }}
                >
                  状態 {selectedStatus !== 'all' && '●'}
                </button>
              </th>
              <th
                onClick={() => handleSort('message_count')}
                className="sortable"
              >
                メッセージ数 {sortBy === 'message_count' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('created_at')}
                className="sortable"
              >
                作成日時 {sortBy === 'created_at' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('updated_at')}
                className="sortable"
              >
                更新日時 {sortBy === 'updated_at' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {threads.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  アーカイブ済みスレッドがありません
                </td>
              </tr>
            ) : (
              threads.map((thread: Thread) => (
                <tr key={thread.id} className={!thread.is_read ? 'unread-row' : ''}>
                  <td>
                    <Link to={`/threads/${thread.id}`} className="thread-link">
                      {thread.title}
                      {!thread.is_read && thread.new_message_count > 0 && (
                        <span className="new-badge">+{thread.new_message_count}</span>
                      )}
                    </Link>
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
                    <span className={`status-badge ${thread.is_read ? 'read' : 'unread'}`}>
                      {thread.is_read ? '既読' : '未読'}
                    </span>
                  </td>
                  <td>{thread.message_count}</td>
                  <td>{dayjs(thread.created_at).format('YYYY/MM/DD HH:mm')}</td>
                  <td>{dayjs(thread.updated_at).fromNow()}</td>
                  <td>
                    <div className="action-buttons">
                      <Link
                        to={`/threads/${thread.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        詳細
                      </Link>
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

      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(total / itemsPerPage)}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
