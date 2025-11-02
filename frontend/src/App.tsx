import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
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
            </div>
          </header>

          <main className="app-main">
            <div className="container">
              <Routes>
                <Route path="/" element={<ThreadListPage />} />
                <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
              </Routes>
            </div>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
