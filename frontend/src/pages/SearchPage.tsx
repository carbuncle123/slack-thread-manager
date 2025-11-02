import React, { useState, useEffect } from 'react';
import { searchApi } from '../lib/api';
import type { QueryResponse, SearchHistoryItem } from '../types';
import './SearchPage.css';

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'bookmarks'>('search');

  // 検索例
  const exampleQueries = [
    "認証機能の実装についての議論はどこで行われていますか？",
    "データベース選定の結論はどうなりましたか？",
    "先週議論された課題で未解決のものは？",
    "セキュリティに関する議論をまとめてください",
  ];

  // 初期化時に履歴を読み込み
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const historyData = await searchApi.getHistory();
      setHistory(historyData);
    } catch (err) {
      console.error('履歴の読み込みに失敗しました:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await searchApi.query({ query });
      setResult(response);
      await loadHistory(); // 履歴を更新
    } catch (err) {
      setError('検索に失敗しました。しばらく時間をおいて再度お試しください。');
      console.error('検索エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleBookmark = async (queryId: string, bookmarked: boolean) => {
    try {
      await searchApi.bookmark(queryId, bookmarked);
      await loadHistory();
      
      // 現在の結果も更新
      if (result && result.query_id === queryId) {
        setResult(prev => prev ? { ...prev, bookmarked } as any : null);
      }
    } catch (err) {
      console.error('ブックマークの更新に失敗しました:', err);
    }
  };

  const handleDeleteQuery = async (queryId: string) => {
    if (!confirm('この検索履歴を削除しますか？')) return;

    try {
      await searchApi.deleteQuery(queryId);
      await loadHistory();
    } catch (err) {
      console.error('検索履歴の削除に失敗しました:', err);
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.7) return 'confidence-high';
    if (confidence >= 0.4) return 'confidence-medium';
    return 'confidence-low';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.7) return '高';
    if (confidence >= 0.4) return '中';
    return '低';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const filteredHistory = () => {
    switch (activeTab) {
      case 'bookmarks':
        return history.filter(item => item.bookmarked);
      case 'history':
        return history;
      default:
        return [];
    }
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <h1 className="search-title">スレッド横断検索</h1>
        <p className="search-description">
          自然言語でスレッドを検索し、過去の議論から必要な情報を見つけることができます。
        </p>
      </div>

      <div className="search-tabs">
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          検索
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          履歴
        </button>
        <button
          className={`tab-button ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          ブックマーク
        </button>
      </div>

      {activeTab === 'search' && (
        <>
          <div className="search-form">
            <div className="search-input-group">
              <textarea
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="質問を入力してください（例：認証機能について議論された内容は？）"
                rows={3}
              />
              <button
                className="search-button"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? '検索中...' : '検索'}
              </button>
            </div>

            <div className="search-examples">
              <div className="examples-title">検索例:</div>
              <div className="example-queries">
                {exampleQueries.map((example, index) => (
                  <span
                    key={index}
                    className="example-query"
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {loading && (
            <div className="loading-spinner">
              <span>検索中...</span>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {result && (
            <div className="search-result">
              <div className="result-header">
                <h3 className="result-question">{result.query}</h3>
                <div className="result-meta">
                  <span className={`confidence-badge ${getConfidenceClass(result.confidence)}`}>
                    信頼度: {getConfidenceText(result.confidence)}
                  </span>
                  <button
                    className={`bookmark-button ${(result as any).bookmarked ? 'bookmarked' : ''}`}
                    onClick={() => handleBookmark(result.query_id, !(result as any).bookmarked)}
                  >
                    ★ {(result as any).bookmarked ? 'ブックマーク済み' : 'ブックマーク'}
                  </button>
                  <span>{formatDate(result.created_at)}</span>
                </div>
              </div>

              <div className="result-answer">
                {result.answer}
              </div>

              {result.related_threads.length > 0 && (
                <div className="related-threads">
                  <h4 className="related-threads-title">関連スレッド</h4>
                  {result.related_threads.map((thread, index) => (
                    <a
                      key={index}
                      href={thread.url || `/threads/${thread.thread_id}`}
                      className="thread-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {thread.title} (ID: {thread.thread_id})
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(activeTab === 'history' || activeTab === 'bookmarks') && (
        <div className="history-list">
          {filteredHistory().length === 0 ? (
            <div className="empty-state">
              {activeTab === 'bookmarks' ? 'ブックマークされた検索がありません。' : '検索履歴がありません。'}
            </div>
          ) : (
            filteredHistory().map((item) => (
              <div key={item.query_id} className="search-result">
                <div className="result-header">
                  <h3 className="result-question">{item.query}</h3>
                  <div className="result-meta">
                    <span className={`confidence-badge ${getConfidenceClass(item.confidence)}`}>
                      信頼度: {getConfidenceText(item.confidence)}
                    </span>
                    <button
                      className={`bookmark-button ${item.bookmarked ? 'bookmarked' : ''}`}
                      onClick={() => handleBookmark(item.query_id, !item.bookmarked)}
                    >
                      ★ {item.bookmarked ? 'ブックマーク済み' : 'ブックマーク'}
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteQuery(item.query_id)}
                    >
                      削除
                    </button>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>

                <div className="result-answer">
                  {item.answer}
                </div>

                {item.related_threads.length > 0 && (
                  <div className="related-threads">
                    <h4 className="related-threads-title">関連スレッド</h4>
                    {item.related_threads.map((thread, index) => (
                      <a
                        key={index}
                        href={thread.url || `/threads/${thread.thread_id}`}
                        className="thread-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {thread.title} (ID: {thread.thread_id})
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;