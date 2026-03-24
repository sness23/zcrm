import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  ExternalLink,
  FileText,
  MessageSquare,
  Table,
  Search,
  Mail,
  User,
  Target,
  BookOpen,
  Users,
  Newspaper,
  Network,
  NotebookPen,
} from 'lucide-react'
import doibioLogo from '../assets/doibio.png'
import UserMenu from '../components/UserMenu'
import AIChat from '../components/AIChat'
import Sidebar from '../components/Sidebar'
import SpotlightSearch from '../components/SpotlightSearch'

interface AppLauncherProps {
  onSettingsClick: () => void
}

interface App {
  id: string
  name: string
  description: string
  url: string
  icon: React.ReactNode
  color: string
  status: 'active' | 'coming-soon'
}

export default function AppLauncher({ onSettingsClick }: AppLauncherProps) {
  const commsButtonRef = useRef<HTMLButtonElement>(null)

  const [headerVisible, setHeaderVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('login-app-header-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  const [compactMode, setCompactMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('login-app-compact-mode')
    return saved !== null ? JSON.parse(saved) : true
  })

  const [appsVisible, setAppsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('login-app-apps-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('login-app-sidebar-visible')
    return saved !== null ? JSON.parse(saved) : false
  })

  const [chatVisible, setChatVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('login-app-chat-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  const [currentChatId, setCurrentChatId] = useState<string>(() => `chat_${Date.now()}`)

  const [chats, setChats] = useState<Array<{ id: string; title: string; timestamp: string; isPinned: boolean }>>([])

  const [spotlightOpen, setSpotlightOpen] = useState(false)

  // Determine base domain based on current hostname
  const isDev = window.location.hostname.includes('local.')
  const isLocalhost = window.location.hostname === 'localhost'
  const protocol = window.location.protocol // http: or https:

  // Generate URLs based on environment
  const getAppUrl = (subdomain: string) => {
    if (import.meta.env[`VITE_${subdomain.toUpperCase()}_URL`]) {
      return import.meta.env[`VITE_${subdomain.toUpperCase()}_URL`]
    }

    // Special case: root app goes to base domain
    if (subdomain === 'root') {
      if (isLocalhost) {
        return 'http://localhost:9108'
      }
      if (isDev) {
        return `${protocol}//local.doi.bio`
      }
      return `${protocol}//doi.bio`
    }

    if (isLocalhost) {
      // Fallback to localhost ports for true localhost
      const ports: Record<string, number> = {
        comms: 9100, tables: 9101, docs: 9102, login: 9103, earn: 9104,
        leads: 9105, search: 9106, contact: 9107, root: 3000, www: 3000,
        es: 9110, email: 9111, analytics: 9112, ads: 9113, blog: 9114,
        party: 9115, obsidian: 9116, news: 9008, graph: 9007
      }
      return `http://localhost:${ports[subdomain] || 9100}`
    }
    if (isDev) {
      return `${protocol}//local.${subdomain}.doi.bio`
    }
    return `${protocol}//${subdomain}.doi.bio`
  }

  const commsUrl = getAppUrl('comms')
  const tablesUrl = getAppUrl('tables')
  const docsUrl = getAppUrl('docs')
  const earnUrl = getAppUrl('earn')
  const leadsUrl = getAppUrl('leads')
  const searchUrl = getAppUrl('search')
  const contactUrl = getAppUrl('contact')
  const emailUrl = getAppUrl('email')
  const analyticsUrl = getAppUrl('analytics')
  const adsUrl = getAppUrl('ads')
  const blogUrl = getAppUrl('blog')
  const partyUrl = getAppUrl('party')
  const newsUrl = getAppUrl('news')
  const graphUrl = getAppUrl('graph')
  const obsidianUrl = getAppUrl('obsidian')

  const apps: App[] = [
    {
      id: 'comms',
      name: 'Comms',
      description: 'Real-time messaging and activity streams',
      url: commsUrl,
      icon: <MessageSquare className="w-8 h-8" />,
      color: 'from-green-500 to-emerald-600',
      status: 'active',
    },
    {
      id: 'tables',
      name: 'Tables',
      description: 'CRM database with entities and relationships',
      url: tablesUrl,
      icon: <Table className="w-8 h-8" />,
      color: 'from-violet-500 to-purple-600',
      status: 'active',
    },
    {
      id: 'docs',
      name: 'Docs',
      description: 'Document editor for CRM records and notes',
      url: docsUrl,
      icon: <FileText className="w-8 h-8" />,
      color: 'from-amber-500 to-orange-600',
      status: 'active',
    },
    {
      id: 'obsidian',
      name: 'Obsidian',
      description: 'Full vault markdown editor with wikilinks',
      url: obsidianUrl,
      icon: <NotebookPen className="w-8 h-8" />,
      color: 'from-violet-500 to-indigo-600',
      status: 'active',
    },
    {
      id: 'search',
      name: 'Search',
      description: 'Search across all CRM vault records',
      url: searchUrl,
      icon: <Search className="w-8 h-8" />,
      color: 'from-yellow-500 to-amber-600',
      status: 'active',
    },
    {
      id: 'graph',
      name: 'Graph',
      description: 'Interactive force-directed graph visualization of vault data',
      url: graphUrl,
      icon: <Network className="w-8 h-8" />,
      color: 'from-cyan-500 to-blue-600',
      status: 'active',
    },
    {
      id: 'leads',
      name: 'Leads',
      description: 'Premium biotech leads marketplace',
      url: leadsUrl,
      icon: <ShoppingCart className="w-8 h-8" />,
      color: 'from-blue-500 to-indigo-600',
      status: 'active',
    },
    {
      id: 'earn',
      name: 'Earn',
      description: 'Monetize your network with lead-to-earn marketplace',
      url: earnUrl,
      icon: <DollarSign className="w-8 h-8" />,
      color: 'from-emerald-500 to-teal-600',
      status: 'active',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'Cross-platform insights and metrics',
      url: analyticsUrl,
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'from-orange-500 to-red-600',
      status: 'active',
    },
    {
      id: 'contact',
      name: 'Contact',
      description: 'Contact management and relationship tracking',
      url: contactUrl,
      icon: <User className="w-8 h-8" />,
      color: 'from-cyan-500 to-blue-600',
      status: 'active',
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Email integration and campaign management',
      url: emailUrl,
      icon: <Mail className="w-8 h-8" />,
      color: 'from-indigo-500 to-purple-600',
      status: 'active',
    },
    {
      id: 'ads',
      name: 'Ads',
      description: 'Helpful, transparent advertising portal',
      url: adsUrl,
      icon: <Target className="w-8 h-8" />,
      color: 'from-red-500 to-pink-600',
      status: 'active',
    },
    {
      id: 'blog',
      name: 'Blog',
      description: 'Stories about biotech, AI, and structural biology',
      url: blogUrl,
      icon: <BookOpen className="w-8 h-8" />,
      color: 'from-fuchsia-500 to-violet-600',
      status: 'active',
    },
    {
      id: 'news',
      name: 'News',
      description: 'Latest news and updates from the biotech industry',
      url: newsUrl,
      icon: <Newspaper className="w-8 h-8" />,
      color: 'from-lime-500 to-green-600',
      status: 'active',
    },
    {
      id: 'party',
      name: 'Party',
      description: 'Customer 360 view with unified profiles and history',
      url: partyUrl,
      icon: <Users className="w-8 h-8" />,
      color: 'from-sky-500 to-cyan-600',
      status: 'active',
    },
  ]

  // Handler functions
  const handleNewChat = useCallback(() => {
    const newChatId = `chat_${Date.now()}`
    const newChat = {
      id: newChatId,
      title: 'New chat',
      timestamp: new Date().toISOString(),
      isPinned: false
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChatId)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Toggle app icons visibility
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAppsVisible(prev => !prev)
      }
      // Shift+Ctrl+K: Open spotlight search
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSpotlightOpen(true)
      }
      // Shift+Ctrl+Y: Toggle header
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        setHeaderVisible(prev => !prev)
      }
      // Shift+Ctrl+X: Toggle chat visibility
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        setChatVisible(prev => !prev)
      }
      // Shift+Ctrl+M: Toggle compact mode (icons only)
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setCompactMode(prev => !prev)
      }
      // Shift+Ctrl+S: Toggle sidebar
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setSidebarVisible(prev => !prev)
      }
      // Shift+Ctrl+N: New chat
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewChat()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  // Persist header visibility to localStorage
  useEffect(() => {
    localStorage.setItem('login-app-header-visible', JSON.stringify(headerVisible))
  }, [headerVisible])

  // Persist compact mode to localStorage
  useEffect(() => {
    localStorage.setItem('login-app-compact-mode', JSON.stringify(compactMode))
  }, [compactMode])

  // Persist apps visibility to localStorage
  useEffect(() => {
    localStorage.setItem('login-app-apps-visible', JSON.stringify(appsVisible))
  }, [appsVisible])

  // Persist sidebar visibility to localStorage
  useEffect(() => {
    localStorage.setItem('login-app-sidebar-visible', JSON.stringify(sidebarVisible))
  }, [sidebarVisible])

  // Persist chat visibility to localStorage
  useEffect(() => {
    localStorage.setItem('login-app-chat-visible', JSON.stringify(chatVisible))
  }, [chatVisible])

  // Load chats from vault on mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        const response = await fetch('http://localhost:9600/api/vault/chats')
        if (response.ok) {
          const data = await response.json()
          if (data.chats && data.chats.length > 0) {
            console.log(`[AppLauncher] Loaded ${data.chats.length} chats from vault`)
            setChats(data.chats)
          }
        }
      } catch (error) {
        console.error('[AppLauncher] Error loading chats:', error)
      }
    }

    loadChats()
  }, [])

  // WebSocket for real-time chat notifications
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9600')

    ws.onopen = () => {
      console.log('[AppLauncher] ✓ WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'new_chat') {
        console.log('[AppLauncher] 📢 Received new chat notification:', data.chat)

        // Check if chat already exists
        setChats(prevChats => {
          if (prevChats.some(c => c.id === data.chat.id)) {
            return prevChats
          }
          // Add new chat to the top of the list
          return [data.chat, ...prevChats]
        })
      }
    }

    ws.onerror = (error) => {
      console.error('[AppLauncher] WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('[AppLauncher] WebSocket disconnected')
    }

    return () => {
      ws.close()
    }
  }, [])

  const handleAppClick = (app: App) => {
    if (app.status === 'coming-soon') return

    // Open app in same tab (they'll have shared session via Supabase)
    window.location.href = app.url
  }

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId)
  }

  const handleChatCreated = (chatId: string, firstMessage: string) => {
    // Check if chat already exists in list
    if (chats.some(c => c.id === chatId)) {
      return
    }

    // Add new chat to list with title from first message
    const newChat = {
      id: chatId,
      title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : ''),
      timestamp: new Date().toISOString(),
      isPinned: false
    }
    setChats(prev => [newChat, ...prev])
  }

  return (
    <div
      className="h-screen bg-gradient-to-br from-[#000040] via-purple-900 to-violet-900 flex flex-col overflow-hidden"
      data-darkreader-inline-bgcolor=""
      data-darkreader-inline-bgimage=""
      style={
        {
          '--darkreader-inline-bgcolor': 'none',
          '--darkreader-inline-bgimage': 'linear-gradient(to bottom right, rgb(0, 0, 64), rgb(88, 28, 135), rgb(109, 40, 217))',
        } as React.CSSProperties
      }
    >
      {/* Header */}
      {headerVisible && (
        <header className="flex-shrink-0 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 border-b border-purple-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => window.location.href = window.location.origin}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="Go to App Launcher"
            >
              <img src={doibioLogo} alt="doi.bio Logo" className="w-10 h-10 rounded" />
              <div>
                <h1 className="text-xl font-bold text-white">doi.bio</h1>
                <p className="text-xs text-gray-400">App Launcher</p>
              </div>
            </button>

            <div className="flex items-center gap-4">
              <UserMenu onSettingsClick={onSettingsClick} />
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Content - Three Column Layout */}
      <main className="flex-1 min-h-0 flex gap-0 w-full">
        {/* Left Sidebar */}
        {sidebarVisible && (
          <Sidebar
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            currentChatId={currentChatId}
            chats={chats}
          />
        )}

        {/* Middle Column - AI Chat */}
        {chatVisible && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col px-4 sm:px-6 py-6">
            <AIChat nextFocusRef={commsButtonRef} chatId={currentChatId} onChatCreated={handleChatCreated} />
          </div>
        )}

        {/* Right Column - App Grid */}
        {appsVisible && (
          <div className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto ${
            !sidebarVisible && !chatVisible ? 'p-4' : 'px-4 sm:px-6 py-6'
          }`}>
            {/* App Grid */}
            <div className={`flex flex-wrap ${
              compactMode
                ? 'gap-0.5 justify-center content-start'
                : 'gap-4 flex-col md:grid md:grid-cols-2 md:auto-rows-min'
            }`}>
          {apps.map((app, index) => (
            <button
              key={app.id}
              ref={index === 0 ? commsButtonRef : null}
              onClick={() => handleAppClick(app)}
              disabled={app.status === 'coming-soon'}
              title={compactMode ? `${app.name}${app.status === 'coming-soon' ? ' (Coming Soon)' : ''}` : undefined}
              className={`relative group bg-gray-800 border border-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 ${
                compactMode ? 'p-2 aspect-square flex items-center justify-center w-20 h-20' : 'p-4 text-left'
              } ${
                app.status === 'coming-soon'
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:-translate-y-1 cursor-pointer'
              }`}
            >
              {compactMode ? (
                /* Compact Mode - Icon Only */
                <div
                  className={`flex items-center justify-center w-full h-full rounded-xl bg-gradient-to-br ${app.color} text-white group-hover:scale-110 transition-transform`}
                  data-darkreader-inline-bgcolor=""
                  data-darkreader-inline-bgimage=""
                >
                  {app.icon}
                </div>
              ) : (
                /* Full Mode - Icon + Text */
                <>
                  {/* Icon */}
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${app.color} text-white mb-4 group-hover:scale-110 transition-transform`}
                    data-darkreader-inline-bgcolor=""
                    data-darkreader-inline-bgimage=""
                  >
                    {app.icon}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    {app.name}
                    {app.status === 'active' && (
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">{app.description}</p>

                  {/* Status Badge */}
                  {app.status === 'coming-soon' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      Coming Soon
                    </span>
                  )}

                  {app.status === 'active' && (
                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-400">
                      Launch App
                      <span className="transform group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  )}
                </>
              )}
            </button>
          ))}
          </div>
        </div>
        )}
      </main>

      {/* Spotlight Search Modal */}
      <SpotlightSearch
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        apps={apps}
        onSelectApp={(app) => {
          setSpotlightOpen(false)
          handleAppClick(app)
        }}
      />
    </div>
  )
}
