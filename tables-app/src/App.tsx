import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AppSwitcher from './components/AppSwitcher';
import TabNav from './components/TabNav';
import TableView from './components/TableView';
import DetailView from './components/DetailView';
import UserMenu from './components/UserMenu';
import Settings from './components/Settings';
import type { Entity, EntityType } from './types';
import { ENTITY_CONFIGS, APP_CONFIGS } from './types';
import doibioLogo from './assets/doibio.png';
import './App.css';

const API_BASE_URL = 'http://localhost:9600/api/entities';
const WS_URL = 'ws://localhost:9600';

function AppContent() {
  // Determine login URL based on current hostname
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

  // View state - 'main' or 'settings'
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');

  // Load selected app from localStorage, default to 'sales'
  const [currentAppId, setCurrentAppId] = useState<string>(() => {
    return localStorage.getItem('tables-app-selected-app') || 'sales';
  });

  const currentApp = APP_CONFIGS.find((app) => app.id === currentAppId)!;

  // Load active tab from localStorage or use first tab of current app
  const [activeTab, setActiveTab] = useState<EntityType>(() => {
    const savedTab = localStorage.getItem('tables-app-active-tab');
    if (savedTab && currentApp.tabs.includes(savedTab as EntityType)) {
      return savedTab as EntityType;
    }
    return currentApp.tabs[0];
  });
  const [data, setData] = useState<Entity[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [viewMode, setViewMode] = useState<'normal' | 'edit'>('edit');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const currentConfig = ENTITY_CONFIGS.find((c) => c.type === activeTab)!;

  // Handle app change
  const handleAppChange = (appId: string) => {
    setCurrentAppId(appId);
    localStorage.setItem('tables-app-selected-app', appId);

    const newApp = APP_CONFIGS.find((app) => app.id === appId)!;

    // If current tab is not in the new app, switch to first tab
    if (!newApp.tabs.includes(activeTab)) {
      const newTab = newApp.tabs[0];
      setActiveTab(newTab);
      localStorage.setItem('tables-app-active-tab', newTab);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: EntityType) => {
    // If clicking the current tab while viewing a detail, go back to list
    if (tab === activeTab && selectedRecord) {
      setSelectedRecord(null);
      return;
    }
    setActiveTab(tab);
    localStorage.setItem('tables-app-active-tab', tab);
  };

  // Fetch data function
  const fetchData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setSelectedRecord(null);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${activeTab}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${activeTab}`);
      }
      const json = await response.json();
      setData(json.entities || []);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setData([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Fetch data when the active tab changes
  useEffect(() => {
    fetchData(false); // Show loading on tab change
  }, [activeTab]);

  // Poll for updates every 1 second (silent)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchData(true); // Silent refresh
    }, 1000); // 1 second

    return () => clearInterval(pollInterval);
  }, [activeTab]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      console.log('🔌 Connecting to WebSocket...');
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message);

          if (message.type === 'entity_changed') {
            // Refresh data if the changed entity matches the active tab
            if (message.entityType === activeTab) {
              console.log(`🔄 Refreshing ${activeTab} data...`);
              fetchData(true); // Silent refresh from WebSocket
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setWsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Reconnecting WebSocket...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeTab]); // Re-connect when tab changes to update message handler

  // Fetch a single record when clicked
  const handleRowClick = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${activeTab}/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch record ${id}`);
      }
      const json = await response.json();
      setSelectedRecord(json);
    } catch (err) {
      console.error('Error fetching record:', err);
    }
  };

  const handleCloseDetail = () => {
    setSelectedRecord(null);
  };

  // Navigate to a related entity (e.g., clicking account_id link)
  const handleNavigate = async (entityType: EntityType, entityIdOrSlug: string) => {
    try {
      // Switch to the appropriate tab
      setActiveTab(entityType);
      localStorage.setItem('tables-app-active-tab', entityType);

      // Check if it's an ID (starts with type prefix like acc_, con_, etc.) or a slug
      const isId = entityIdOrSlug.match(/^[a-z]{3}_/);

      if (isId) {
        // Fetch by ID directly
        const response = await fetch(`${API_BASE_URL}/${entityType}/${entityIdOrSlug}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${entityType} ${entityIdOrSlug}`);
        }
        const json = await response.json();
        setSelectedRecord(json);
      } else {
        // It's a slug - fetch all entities and find by slug match
        const response = await fetch(`${API_BASE_URL}/${entityType}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${entityType}`);
        }
        const json = await response.json();

        // Find entity by slug (convert name to slug and compare)
        const entity = json.entities?.find((e: any) => {
          const nameSlug = e.name?.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-');
          return nameSlug === entityIdOrSlug || e.id === entityIdOrSlug;
        });

        if (entity) {
          // Fetch full record by ID
          const recordResponse = await fetch(`${API_BASE_URL}/${entityType}/${entity.id}`);
          if (recordResponse.ok) {
            const record = await recordResponse.json();
            setSelectedRecord(record);
          }
        }
      }
    } catch (err) {
      console.error('Error navigating to related entity:', err);
    }
  };

  // Toggle view mode
  const handleToggleViewMode = () => {
    setViewMode(prev => prev === 'normal' ? 'edit' : 'normal');
  };

  // Show login if not authenticated
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
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
        <div className="header-content">
          <div className="header-left">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="App Logo" className="app-logo" />
            </a>
            <div className="header-text">
              <h1>tables</h1>
              <div className="header-subtitle">
                {wsConnected && (
                  <span style={{ color: '#4CAF50', fontSize: '12px' }}>
                    ● Live
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="header-center">
            <AppSwitcher currentAppId={currentAppId} onAppChange={handleAppChange} />
          </div>
          <div className="header-right">
            <UserMenu onSettingsClick={() => setCurrentView('settings')} />
          </div>
        </div>
      </header>

      <TabNav activeTab={activeTab} onTabChange={handleTabChange} visibleTabs={currentApp.tabs} />

      <main className="app-main">
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading {currentConfig.labelPlural}...</div>
        ) : selectedRecord ? (
          <DetailView
            config={currentConfig}
            data={selectedRecord}
            onClose={handleCloseDetail}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
            onNavigate={handleNavigate}
          />
        ) : (
          <TableView
            config={currentConfig}
            data={data}
            onRowClick={handleRowClick}
          />
        )}
      </main>
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
