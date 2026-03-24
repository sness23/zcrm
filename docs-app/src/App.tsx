import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import FileTree from './components/FileTree';
import MarkdownEditor from './components/MarkdownEditor';
import CommsSection from './components/CommsSection';
import UserMenu from './components/UserMenu';
import Settings from './components/Settings';
import type { FileNode } from './types';
import doibioLogo from './assets/doibio.png';
import './App.css';

const API_BASE_URL = 'http://localhost:9600/api';

function AppContent() {
  const getLoginUrl = () => {
    const isDev = window.location.hostname.includes('local.')
    const isLocalhost = window.location.hostname === 'localhost'
    const protocol = window.location.protocol

    if (isLocalhost) {
      return 'http://localhost:9103'
    }
    if (isDev) {
      return `${protocol}//local.login.doi.bio`
    }
    return `${protocol}//login.doi.bio`
  }

  const { user, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);

  // Load file tree function with silent mode
  const loadFileTree = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files`);
      if (!response.ok) {
        throw new Error('Failed to load file tree');
      }
      const data = await response.json();
      setFileTree(data);
    } catch (error) {
      if (!silent) {
        console.error('Error loading file tree:', error);
        alert('Failed to load file tree. Make sure the API server is running.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Load file tree on mount (show loading)
  useEffect(() => {
    loadFileTree(false);
  }, []);

  // Poll for file tree updates every 1 second (silent)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadFileTree(true); // Silent refresh
    }, 1000); // 1 second

    return () => clearInterval(pollInterval);
  }, []);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleSave = async (
    path: string,
    content: string,
    frontmatter: Record<string, any>
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, frontmatter }),
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  };

  const handleEntityInfo = useCallback((id: string | null, type: string | null) => {
    setEntityId(id);
    setEntityType(type);
  }, []);

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) {
      alert('Please enter a document title');
      return;
    }

    setCreatingDoc(true);
    try {
      const response = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newDocTitle.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create document');
      }

      const data = await response.json();

      // Close modal and reset
      setShowNewDocModal(false);
      setNewDocTitle('');

      // Refresh file tree and select the new document
      await loadFileTree(true);
      setSelectedFile(data.path);
    } catch (error: any) {
      console.error('Error creating document:', error);
      alert(error.message || 'Failed to create document');
    } finally {
      setCreatingDoc(false);
    }
  };

  // Show login if not authenticated
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-tree">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // If showing settings, render settings page
  if (currentView === 'settings') {
    return (
      <div className="app">
        <Settings onBack={() => setCurrentView('main')} />
      </div>
    );
  }

  // Otherwise show main app
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-home" onClick={() => setSelectedFile(null)}>
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="Quip Logo" className="app-logo" />
            </a>
            <h1>docs</h1>
          </div>
        </div>
        <div className="header-right">
          <button
            className="sidebar-toggle"
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            title="Toggle Activity Feed"
          >
            {rightSidebarCollapsed ? '💬' : '×'}
          </button>
          <UserMenu onSettingsClick={() => setCurrentView('settings')} />
        </div>
      </header>

      <div className="app-content">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <h2>Documents</h2>
            <button
              className="sidebar-toggle plus-button"
              onClick={() => setShowNewDocModal(true)}
              title="New Document"
            >
              +
            </button>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              ×
            </button>
          </div>
          <div className="sidebar-content">
            {loading ? (
              <div className="loading-tree">Loading files...</div>
            ) : (
              <>
                <FileTree
                  nodes={fileTree.filter(node => node.isDocuments)}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedFile}
                />
                <div className="sidebar-section-divider"></div>
                <div className="sidebar-section-header">
                  <h3>Objects</h3>
                </div>
                <FileTree
                  nodes={fileTree.filter(node => !node.isDocuments)}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedFile}
                />
              </>
            )}
          </div>
        </aside>

        <main className="main-content">
          <MarkdownEditor
            filePath={selectedFile}
            onSave={handleSave}
            onEntityInfo={handleEntityInfo}
          />
        </main>

        <aside className={`right-sidebar ${rightSidebarCollapsed ? 'collapsed' : ''}`}>
          {entityId && entityType ? (
            <CommsSection
              entityId={entityId}
              entityType={entityType}
            />
          ) : (
            <div className="right-sidebar-placeholder">
              <p>Select a document to see activity</p>
            </div>
          )}
        </aside>
      </div>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="modal-overlay" onClick={() => setShowNewDocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Document</h2>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Enter document title"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creatingDoc) {
                  handleCreateDocument();
                }
              }}
            />
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowNewDocModal(false);
                  setNewDocTitle('');
                }}
                disabled={creatingDoc}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={creatingDoc || !newDocTitle.trim()}
                className="primary"
              >
                {creatingDoc ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
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
