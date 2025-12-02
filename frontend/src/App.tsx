import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import DiscoverPage from './pages/DiscoverPage';
import SearchPage from './pages/SearchPage';
import ArchivedThreadsPage from './pages/ArchivedThreadsPage';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
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
                <Link to="/discover" className="nav-link">新規発見</Link>
              </nav>
            </div>
          </header>

          <main className="app-main">
            <div className="container">
              <Routes>
                <Route path="/" element={<ThreadListPage />} />
                <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
                <Route path="/archived" element={<ArchivedThreadsPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/search" element={<SearchPage />} />
              </Routes>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
