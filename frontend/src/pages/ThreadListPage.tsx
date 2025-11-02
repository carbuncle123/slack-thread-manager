import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { threadsApi } from '../lib/api';
import { FilterPanel, type FilterState } from '../components/FilterPanel';
import { Pagination } from '../components/Pagination';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';
import './ThreadListPage.css';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export default function ThreadListPage() {
  // フィルター状態
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    tags: [],
    isRead: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // ソート状態
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // APIパラメータを構築
  const apiParams = useMemo(() => {
    const params: any = {
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
    };

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.tags.length > 0) {
      params.tags = filters.tags.join(',');
    }

    if (filters.isRead !== 'all') {
      params.is_read = filters.isRead === 'read';
    }

    if (filters.dateFrom) {
      params.date_from = filters.dateFrom;
    }

    if (filters.dateTo) {
      params.date_to = filters.dateTo;
    }

    return params;
  }, [filters, sortBy, sortOrder, currentPage, itemsPerPage]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['threads', apiParams],
    queryFn: () => threadsApi.getThreads(apiParams),
  });

  // 利用可能なタグを収集
  const availableTags = useMemo(() => {
    if (!data?.threads) return [];
    const tagSet = new Set<string>();
    data.threads.forEach(thread => {
      thread.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [data]);

  const handleSyncAll = async () => {
    try {
      await threadsApi.syncAll();
      refetch();
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

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
          <Link to="/discover" className="btn btn-secondary">
            新規スレッド発見
          </Link>
          <button onClick={handleSyncAll} className="btn btn-primary">
            全スレッド同期
          </button>
        </div>
      </div>

      {/* フィルターパネル */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        availableTags={availableTags}
      />

      {/* 結果サマリー */}
      <div className="results-summary">
        <p>{total} 件のスレッドが見つかりました</p>
      </div>

      {threads.length === 0 ? (
        <div className="empty-state">
          <p>条件に一致するスレッドがありません</p>
        </div>
      ) : (
        <>
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
                  <th>タグ</th>
                  <th>アクション</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((thread) => (
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
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-secondary"
                      >
                        Slack
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          <Pagination
            currentPage={currentPage}
            totalItems={total}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </>
      )}
    </div>
  );
}
