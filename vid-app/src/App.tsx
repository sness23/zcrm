import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import Settings from './components/Settings';
import VideoPlayer from './VideoPlayer';
import { loadVideos } from './loadVideos';

interface Video {
  id: string;
  title: string;
  filename: string;
  created: string;
  tags?: string[];
  type?: 'file' | 'youtube';
  url?: string;
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeader, setShowHeader] = useState(true);

  console.log('[App] Component rendered, loading:', loading, 'videos:', videos);

  useEffect(() => {
    console.log('[App] useEffect running, loading videos...');
    loadVideos().then((data) => {
      console.log('[App] Videos loaded from loadVideos:', data);
      setVideos(data);
      setLoading(false);
      console.log('[App] Set loading to false');
    }).catch(err => {
      console.error('[App] Error loading videos:', err);
    });
  }, []);

  // Shift+Ctrl+Y to toggle header
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setShowHeader(prev => !prev);
        console.log('[App] Shift+Ctrl+Y pressed, toggling header');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading if auth is still checking
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  // Show settings if requested
  if (currentView === 'settings') {
    return <Settings onBack={() => setCurrentView('main')} />;
  }

  // Show loading for videos
  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        {showHeader && <Header onSettingsClick={() => setCurrentView('settings')} />}
        <div className="flex-1 flex items-center justify-center bg-black text-white">
          <div className="text-xl">Loading videos...</div>
        </div>
      </div>
    );
  }

  // Main video player view
  return (
    <div className="flex flex-col h-screen">
      {showHeader && <Header onSettingsClick={() => setCurrentView('settings')} />}
      <div className="flex-1 overflow-hidden">
        <VideoPlayer videos={videos} />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
