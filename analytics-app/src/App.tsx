import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import ChatPanel from './components/ChatPanel'
import doibioLogo from './assets/doibio.png'
import './App.css'

interface SystemEvent {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  message: string
  timestamp: string
  details?: string
}

interface Metrics {
  activeUsers: number
  visitorSessions: number
  messagesPerMin: number
  messagesToday: number
}

function App() {
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

  const [events, setEvents] = useState<SystemEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    activeUsers: 0,
    visitorSessions: 0,
    messagesPerMin: 0,
    messagesToday: 0,
  })
  const [isConnected, setIsConnected] = useState(false)
  const [leftVisible, setLeftVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('analytics-app-left-visible')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [rightVisible, setRightVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('analytics-app-right-visible')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('analytics-app-header-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  const wsRef = useRef<WebSocket | null>(null)
  const eventsPanelRef = useRef<HTMLDivElement>(null)
  const eventCounterRef = useRef(0)

  // Connect to WebSocket
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:9600`)

    ws.onopen = () => {
      console.log('[Analytics] WebSocket connected')
      setIsConnected(true)

      // Add connection event
      addSystemEvent({
        id: `event_${Date.now()}`,
        type: 'success',
        message: 'Connected to real-time event stream',
        timestamp: new Date().toISOString(),
      })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Add system event for any activity
        if (data.type) {
          addSystemEvent({
            id: `event_${Date.now()}_${Math.random()}`,
            type: getEventType(data.type),
            message: formatEventMessage(data),
            timestamp: new Date().toISOString(),
          })
        }
      } catch (error) {
        console.error('[Analytics] Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[Analytics] WebSocket error:', error)
      addSystemEvent({
        id: `event_${Date.now()}`,
        type: 'error',
        message: 'WebSocket connection error',
        timestamp: new Date().toISOString(),
      })
    }

    ws.onclose = () => {
      console.log('[Analytics] WebSocket disconnected')
      setIsConnected(false)
      addSystemEvent({
        id: `event_${Date.now()}`,
        type: 'warning',
        message: 'Disconnected from real-time event stream',
        timestamp: new Date().toISOString(),
      })
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [])

  // Fetch real metrics from API
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('http://localhost:9600/api/metrics')
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
        }
      } catch (error) {
        console.error('[Analytics] Error fetching metrics:', error)
      }
    }

    // Fetch immediately on mount
    fetchMetrics()

    // Then fetch every 5 seconds
    const interval = setInterval(fetchMetrics, 5000)

    return () => clearInterval(interval)
  }, [])

  // Persist panel visibility to localStorage
  useEffect(() => {
    localStorage.setItem('analytics-app-left-visible', JSON.stringify(leftVisible))
  }, [leftVisible])

  useEffect(() => {
    localStorage.setItem('analytics-app-right-visible', JSON.stringify(rightVisible))
  }, [rightVisible])

  useEffect(() => {
    localStorage.setItem('analytics-app-header-visible', JSON.stringify(headerVisible))
  }, [headerVisible])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+H: Toggle right side (metrics/events/charts)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setRightVisible(prev => !prev)
      }
      // Ctrl+Shift+X: Toggle left side (chat)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        setLeftVisible(prev => !prev)
      }
      // Ctrl+Shift+Y: Toggle header
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        setHeaderVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Helper functions
  const addSystemEvent = (event: SystemEvent) => {
    // Ensure unique IDs by adding a counter
    const uniqueEvent = {
      ...event,
      id: `${event.id}_${eventCounterRef.current++}`
    }
    setEvents((prev) => [uniqueEvent, ...prev].slice(0, 100))

    // Auto-scroll events panel
    setTimeout(() => {
      if (eventsPanelRef.current) {
        eventsPanelRef.current.scrollTop = 0
      }
    }, 100)
  }

  const getEventType = (type: string): SystemEvent['type'] => {
    if (type.includes('error') || type.includes('failed')) return 'error'
    if (type.includes('warn') || type.includes('slow')) return 'warning'
    if (type.includes('create') || type.includes('success')) return 'success'
    return 'info'
  }

  const formatEventMessage = (data: any): string => {
    // Handle channel messages
    if (data.type === 'channel_message') {
      const msg = data.message
      return `${msg.author_name || 'Unknown'}: ${msg.text?.substring(0, 50) || 'New message'}${msg.text?.length > 50 ? '...' : ''}`
    }
    // Handle string messages
    if (data.message && typeof data.message === 'string') return data.message
    if (data.type === 'entity_created') return `Created ${data.entityType}: ${data.name}`
    if (data.type === 'api_request') return `API ${data.method} ${data.endpoint}`
    if (data.type === 'search_query') return `Search: "${data.query}"`
    return `Event: ${data.type}`
  }

  const getEventIcon = (type: SystemEvent['type']) => {
    switch (type) {
      case 'success': return '🟢'
      case 'info': return '🔵'
      case 'warning': return '🟡'
      case 'error': return '🔴'
      default: return '⚪'
    }
  }


  return (
    <div className="dashboard">
      {/* Header */}
      {headerVisible && (
        <header className="dashboard-header">
          <div className="header-left">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="doi.bio Logo" className="header-logo" />
            </a>
            <div className="header-content">
              <h1>📊 doi.bio Analytics - Live Operations Dashboard</h1>
              <p>
                Real-time monitoring and insights
                <span style={{ marginLeft: '1rem', color: isConnected ? '#10b981' : '#ef4444' }}>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
                <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: '#b0b0b0' }}>
                  • Ctrl+Shift+Y: Toggle Header • Ctrl+Shift+X: Toggle Chat • Ctrl+Shift+H: Toggle Metrics
                </span>
              </p>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className="dashboard-content">
        <div
          className={`main-grid ${leftVisible && !rightVisible ? 'left-only' : ''} ${!leftVisible && rightVisible ? 'right-only' : ''}`}
          style={{
            gridTemplateColumns: leftVisible && !rightVisible ? '1fr' : !leftVisible && rightVisible ? '1fr' : '3fr 1fr',
            width: '100%',
            height: '100%'
          }}
        >
          {/* Left: #general Chat */}
          {leftVisible && (
            <div className="left-column">
              <ChatPanel headerVisible={headerVisible} />
            </div>
          )}

          {/* Right Column: Metrics, Events, and Charts */}
          {rightVisible && (
            <div className="right-column">
              {/* Compact Metrics Display */}
              <div className="metrics-compact">
                <div className="metric-item">
                  <span className="metric-icon">🔌</span>
                  <span className="metric-num">{metrics.activeUsers}</span>
                  <span className="metric-lbl">connections</span>
                </div>
                <div className="metric-item">
                  <span className="metric-icon">👁️</span>
                  <span className="metric-num">{metrics.visitorSessions}</span>
                  <span className="metric-lbl">visitors</span>
                </div>
                <div className="metric-item">
                  <span className="metric-icon">💬</span>
                  <span className="metric-num">{metrics.messagesPerMin}</span>
                  <span className="metric-lbl">msg/min</span>
                </div>
                <div className="metric-item">
                  <span className="metric-icon">📊</span>
                  <span className="metric-num">{metrics.messagesToday}</span>
                  <span className="metric-lbl">today</span>
                </div>
              </div>

              {/* System Event Log */}
              <div className="panel">
                <div className="panel-content" ref={eventsPanelRef}>
                  {events.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">📋</div>
                      <p>No events yet...</p>
                    </div>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className={`event ${event.type}`}>
                        <span className="event-icon">{getEventIcon(event.type)}</span>
                        <div className="event-content">
                          <div className="event-message">{event.message}</div>
                          <div className="event-time">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
