import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import SearchPage from './pages/SearchPage';
import ArchivedThreadsPage from './pages/ArchivedThreadsPage';
import ChannelExportPage from './pages/ChannelExportPage';
import { SlackCredentialsModal } from './components/SlackCredentialsModal';
import { configApi } from './lib/api';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function SlackAuthBanner() {
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);

  const { data: authStatus } = useQuery({
    queryKey: ['slack-auth-status'],
    queryFn: () => configApi.getSlackAuthStatus(),
    refetchInterval: 30000,
  });

  const { data: appConfig } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.getConfig(),
    enabled: authStatus?.auth_valid === false,
  });

  if (!authStatus || authStatus.auth_valid) return null;

  return (
    <>
      <div className="slack-auth-error-banner">
        <div className="container">
          <span className="banner-icon">!</span>
          <span className="banner-message">
            Slack認証に失敗しました: {authStatus.error}
            &nbsp;&mdash;&nbsp;定期同期・エクスポートは停止中です
          </span>
          <button
            className="btn btn-sm btn-banner"
            onClick={() => setIsCredentialsModalOpen(true)}
          >
            認証情報を再設定
          </button>
        </div>
      </div>
      <SlackCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        currentXoxcToken={appConfig?.slack.xoxc_token}
        currentCookie={appConfig?.slack.cookie}
      />
    </>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <div className="app">
        <SlackAuthBanner />
        <header className="app-header">
          <div className="container">
            <h1>
              <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                Slack Thread Manager
              </Link>
            </h1>
            <nav className="main-nav">
              <Link to="/" className="nav-link">スレッド一覧</Link>
              <Link to="/archived" className="nav-link">アーカイブ</Link>
              <Link to="/search" className="nav-link">検索</Link>
              <Link to="/export" className="nav-link">データDL</Link>
            </nav>
          </div>
        </header>

        <main className="app-main">
          <div className="container">
            <Routes>
              <Route path="/" element={<ThreadListPage />} />
              <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
              <Route path="/archived" element={<ArchivedThreadsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/export" element={<ChannelExportPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
