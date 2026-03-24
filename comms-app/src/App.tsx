import { useState, useEffect, useRef, useMemo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import NewChannelModal from './components/NewChannelModal'
import UserProfile from './components/UserProfile'
import SettingsModal from './components/SettingsModal'
import AppLauncher from './components/AppLauncher'
import { useAIChat } from './hooks/useAIChat'
import ReactMarkdown from 'react-markdown'
import doibioLogo from './assets/doibio.png'
import './App.css'

interface Event {
  event_id: string
  type: string
  entity_type?: string
  entity_id?: string
  status: string
  timestamp: string
  error?: string
  changes?: {
    diff?: string
    [key: string]: any
  }
  data?: {
    [key: string]: any
  }
}

interface Entity {
  id: string
  name: string
  type: string
  [key: string]: any
}

interface Channel {
  id: string
  name: string
  created_at: string
  description?: string
}

interface AIChat {
  id: string
  title: string
  timestamp: string
  isPinned: boolean
}

interface VisitorSession {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  message: string | null
  pageUrl: string
  userAgent: string
  ipAddress: string
  connectedAt: string
  disconnectedAt: string | null
  lastActivity: string
  status: 'browsing' | 'chatting' | 'submitted' | 'disconnected' | 'offline'
  isOnline: boolean
  unreadCount: number
}

interface ChannelMessage {
  id: string
  channel_id: string
  author: string
  author_name: string
  text: string
  timestamp: string
  tokens?: {
    input: number
    output: number
  }
}

interface EntitySection {
  type: string
  label: string
  icon: string
  entities: Entity[]
  expanded: boolean
}

const ENTITY_TYPES = [
  { type: 'accounts', label: 'Accounts', icon: '🏢' },
  { type: 'contacts', label: 'Contacts', icon: '👤' },
  { type: 'opportunities', label: 'Opportunities', icon: '💰' },
  { type: 'leads', label: 'Leads', icon: '🎯' },
  { type: 'activities', label: 'Activities', icon: '📅' },
  { type: 'tasks', label: 'Tasks', icon: '✓' },
  { type: 'quotes', label: 'Quotes', icon: '📄' },
  { type: 'products', label: 'Products', icon: '📦' },
  { type: 'campaigns', label: 'Campaigns', icon: '📢' },
]

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

  const { user, loading: authLoading } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<string>('ch_general')
  const [selectedChannelType, setSelectedChannelType] = useState<'channel' | 'object' | 'visitor'>('channel')
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([])
  const [visitorSessions, setVisitorSessions] = useState<VisitorSession[]>([])
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [entitySections, setEntitySections] = useState<EntitySection[]>([])
  const [pinnedChannels, setPinnedChannels] = useState<string[]>(() => {
    const saved = localStorage.getItem('comms-app-pinned-channels')
    return saved ? JSON.parse(saved) : []
  })
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('comms-app-collapsed-sections')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [messageText] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChannelModal, setShowNewChannelModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [entityMarkdown, setEntityMarkdown] = useState<string | null>(null)
  const [aiStreamingMessage, setAiStreamingMessage] = useState<string>('')
  const [isAIStreaming, setIsAIStreaming] = useState(false)
  const [messageHistory, setMessageHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('comms-app-message-history')
    return saved ? JSON.parse(saved) : []
  })
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [tempMessage, setTempMessage] = useState<string>('')
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('comms-app-sidebar-visible')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [messageMode, setMessageMode] = useState<'chat' | 'ai' | 'unix'>(() => {
    const saved = localStorage.getItem('comms-app-message-mode')
    return saved ? (saved as 'chat' | 'ai' | 'unix') : 'chat'
  })
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('comms-app-header-visible')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [appsVisible, setAppsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('comms-app-apps-visible')
    return saved !== null ? JSON.parse(saved) : false
  })
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('comms-app-compact-mode')
    return saved !== null ? JSON.parse(saved) : false
  })
  const [aiChats, setAiChats] = useState<AIChat[]>([])
  const [currentAIChatId, setCurrentAIChatId] = useState<string | null>(null)
  const [hasShownDeprecationNotice, setHasShownDeprecationNotice] = useState(() => {
    return localStorage.getItem('comms-app-shown-ai-prefix-deprecation') === 'true'
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const pendingE2ETimingRef = useRef<Map<string, any>>(new Map())
  const aiStreamingMessageRef = useRef<string>('')
  const isLoadingMoreRef = useRef(false)
  const userHasScrolledRef = useRef(false)

  // Refs to track current channel state for WebSocket callbacks
  const selectedChannelRef = useRef(selectedChannel)
  const selectedChannelTypeRef = useRef(selectedChannelType)
  const selectedVisitorIdRef = useRef(selectedVisitorId)

  // Keep refs in sync with state
  useEffect(() => {
    selectedChannelRef.current = selectedChannel
    selectedChannelTypeRef.current = selectedChannelType
    selectedVisitorIdRef.current = selectedVisitorId
  }, [selectedChannel, selectedChannelType, selectedVisitorId])

  // Handle URL parameters on mount (e.g., ?visitor=vis_123)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const visitorId = urlParams.get('visitor')

    if (visitorId) {
      // Wait a bit for visitor sessions to load, then select the visitor
      setTimeout(() => {
        handleVisitorClick(visitorId)
        // Clear URL parameter after handling
        window.history.replaceState({}, '', window.location.pathname)
      }, 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Get username from auth context
  const getUserName = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  }

  // AI command detection helper
  // Supports: %co, %ask, %explain, %summarize (new prefixes)
  // Legacy support: @c (with deprecation notice)
  const detectAICommand = (text: string): { isAI: boolean; query: string; isLegacy: boolean; systemPrompt?: string } => {
    const trimmed = text.toLowerCase()

    // New AI command prefixes
    const aiCommands = [
      { prefix: '%co ', systemPrompt: undefined },
      { prefix: '%ask ', systemPrompt: undefined },
      { prefix: '%explain ', systemPrompt: 'Provide a clear, detailed explanation of:' },
      { prefix: '%summarize ', systemPrompt: 'Provide a concise summary of:' },
    ]

    for (const cmd of aiCommands) {
      if (trimmed.startsWith(cmd.prefix)) {
        const query = text.slice(cmd.prefix.length).trim()
        return { isAI: true, query, isLegacy: false, systemPrompt: cmd.systemPrompt }
      }
    }

    // Legacy @c support (deprecated)
    if (trimmed.startsWith('@c ')) {
      const query = text.slice(3).trim()
      return { isAI: true, query, isLegacy: true, systemPrompt: undefined }
    }

    return { isAI: false, query: '', isLegacy: false }
  }

  // Memoize AI chat options to avoid recreating on every render
  const aiChatOptions = useMemo(() => {
    if (selectedChannelType === 'object' && selectedChannel !== 'all') {
      const entityType = entitySections.find(s => s.entities.some(e => e.id === selectedChannel))?.type
      return {
        channelType: 'object' as const,
        entityId: selectedChannel,
        entityType
      }
    }
    return { channelType: 'channel' as const }
  }, [selectedChannelType, selectedChannel, entitySections])

  const { sendAIMessage } = useAIChat(aiChatOptions)

  // Auto-scroll to bottom on new messages or message updates (streaming)
  useEffect(() => {
    // During AI streaming, always auto-scroll (instant, no animation to prevent jitter)
    // Otherwise, only scroll if user hasn't manually scrolled away
    if (isAIStreaming || !userHasScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [channelMessages, aiStreamingMessage, events.length, isAIStreaming])

  // Detect scroll to top for infinite scrolling and track manual scrolling
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || selectedChannelType !== 'channel') return

    const handleScroll = () => {
      // Check if user is near the bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100

      // If user scrolls away from the bottom, mark that they've manually scrolled
      if (!isNearBottom) {
        userHasScrolledRef.current = true
      } else {
        // If they're back near the bottom, reset the flag so auto-scroll can resume
        userHasScrolledRef.current = false
      }

      if (isLoadingMoreRef.current || !hasMoreMessages) return

      // Load more when scrolled to within 200px of top
      if (container.scrollTop < 200) {
        loadOlderMessages()
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [selectedChannel, selectedChannelType, hasMoreMessages, channelMessages])

  useEffect(() => {
    fetchEvents()
    fetchAllEntities()
    fetchChannels()
    fetchVisitorSessions()
    loadAIChats()

    // Poll for new events and entities every 2 seconds
    const interval = setInterval(() => {
      fetchEvents()
      fetchAllEntities()
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: New AI chat
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleNewAIChat()
      }
      // Shift+Ctrl+S: Toggle sidebar
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setSidebarVisible(prev => !prev)
      }
      // Shift+Ctrl+Y: Toggle header
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        setHeaderVisible(prev => !prev)
      }
      // Shift+Ctrl+K: Toggle compact mode (icons only)
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCompactMode(prev => !prev)
      }
      // Shift+Ctrl+H: Toggle apps launcher
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setAppsVisible(prev => !prev)
      }
      // Shift+Ctrl+Z: Reset view (show all hidden elements)
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setSidebarVisible(true)
        setHeaderVisible(true)
        setAppsVisible(true)
        console.log('View reset: all elements visible')
      }
      // ESC: Focus chat input
      if (e.key === 'Escape') {
        e.preventDefault()
        messageInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Persist sidebar visibility to localStorage
  useEffect(() => {
    localStorage.setItem('comms-app-sidebar-visible', JSON.stringify(sidebarVisible))
  }, [sidebarVisible])

  // Persist header visibility to localStorage
  useEffect(() => {
    localStorage.setItem('comms-app-header-visible', JSON.stringify(headerVisible))
  }, [headerVisible])

  // Persist apps visibility to localStorage
  useEffect(() => {
    localStorage.setItem('comms-app-apps-visible', JSON.stringify(appsVisible))
  }, [appsVisible])

  // Persist compact mode to localStorage
  useEffect(() => {
    localStorage.setItem('comms-app-compact-mode', JSON.stringify(compactMode))
  }, [compactMode])

  // Persist message mode to localStorage
  useEffect(() => {
    localStorage.setItem('comms-app-message-mode', messageMode)
  }, [messageMode])

  // Fetch channel messages when channel changes
  useEffect(() => {
    if (selectedChannelType === 'channel') {
      // Reset manual scroll flag when switching channels
      userHasScrolledRef.current = false
      // Fetch messages for all channels including DM
      fetchChannelMessages(selectedChannel, true) // true = initial load
      setEntityMarkdown(null) // Clear markdown when viewing a channel
      // Focus input when viewing a channel
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
    } else if (selectedChannelType === 'object' && selectedChannel !== 'all') {
      // Fetch markdown for entity
      fetchEntityMarkdown(selectedChannel)
      // Focus input when viewing an object with input
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
    } else {
      setEntityMarkdown(null) // Clear markdown for 'all' view
    }
  }, [selectedChannel, selectedChannelType])

  // WebSocket for real-time channel messages
  useEffect(() => {
    // Prevent double connection in React Strict Mode
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log('[Comms-App] 🔌 WebSocket already exists with state:', state)
        return
      }
    }

    console.log('[Comms-App] 🔌 Creating new WebSocket connection to ws://localhost:9600')
    const ws = new WebSocket('ws://localhost:9600')

    ws.onopen = () => {
      console.log('[Comms-App] ✅ WebSocket connected successfully!')
    }

    ws.onmessage = (event) => {
      // DIAGNOSTIC: Log ALL incoming WebSocket messages
      console.log('[Comms-App] 🔵 WebSocket message received (RAW):', event.data.substring(0, 200))

      // T2: Record WebSocket message received
      const t2_recv = performance.now()

      const data = JSON.parse(event.data)

      // DIAGNOSTIC: Log parsed message type
      console.log('[Comms-App] 🔵 WebSocket message parsed, type:', data.type)

      if (data.type === 'channel_message') {
        const messageId = data.timing?.messageId
        const message = data.message

        console.log('[Comms-App] 📨 Received channel_message:', {
          channel_id: data.channel_id,
          message_id: messageId,
          text: message.text?.substring(0, 50),
          currentChannel: selectedChannelRef.current,
          currentChannelType: selectedChannelTypeRef.current,
          willDisplay: selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current
        })

        // Add new message to channel messages if we're viewing that channel
        // Use refs to get current values (avoid stale closure)
        if (selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current) {
          setChannelMessages(prev => {
            // T3: Record DOM update time
            const t3_recv = performance.now()

            // Schedule measurement after React renders
            requestAnimationFrame(() => {
              // T4: Record visible to user time (after paint)
              const t4_recv = performance.now()

              // Get sender timing from the WebSocket broadcast
              if (data.timing && data.timing.t0_send) {
                if (data.timing.t1_send) {
                  // We have complete timing - record immediately
                  const e2eRecord = {
                    messageId: messageId,
                    channelId: data.channel_id,
                    text: message.text,
                    t0_send: data.timing.t0_send,
                    t1_send: data.timing.t1_send,
                    t_api: data.timing.t_api,
                    t_db_start: data.timing.t_db_start,
                    t_db_end: data.timing.t_db_end,
                    t_md_start: data.timing.t_md_start,
                    t_md_end: data.timing.t_md_end,
                    t_ws_broadcast: data.timing.t_ws_broadcast,
                    t2_recv: t2_recv,
                    t3_recv: t3_recv,
                    t4_recv: t4_recv
                  }

                  const totalE2E = t4_recv - data.timing.t0_send

                  console.log('[RECEIVER]', {
                    messageId,
                    receivedLatency: (t2_recv - data.timing.t_ws_broadcast).toFixed(2) + 'ms',
                    uiUpdateLatency: (t4_recv - t2_recv).toFixed(2) + 'ms',
                    totalE2E: totalE2E.toFixed(2) + 'ms'
                  })

                  // Send to E2E latency endpoint
                  fetch('http://localhost:9600/api/latency/e2e/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(e2eRecord)
                  }).catch(err => console.warn('Failed to record E2E latency:', err))
                } else {
                  // t1_send is missing - store pending timing for later
                  pendingE2ETimingRef.current.set(messageId, {
                    channelId: data.channel_id,
                    text: message.text,
                    t_api: data.timing.t_api,
                    t_db_start: data.timing.t_db_start,
                    t_db_end: data.timing.t_db_end,
                    t_md_start: data.timing.t_md_start,
                    t_md_end: data.timing.t_md_end,
                    t_ws_broadcast: data.timing.t_ws_broadcast,
                    t2_recv: t2_recv,
                    t3_recv: t3_recv,
                    t4_recv: t4_recv
                  })

                  console.log('[RECEIVER - PENDING]', {
                    messageId,
                    note: 'Waiting for sender t1_send timing'
                  })
                }
              }
            })

            // Check if message already exists (prevent duplicates from optimistic updates)
            if (prev.some(m => m.id === message.id)) {
              return prev
            }

            return [...prev, message]
          })
        }
      } else if (data.type === 'timing_update') {
        // Handle timing update broadcast (when sender posts t1_send)
        const messageId = data.messageId
        const timing = data.timing

        if (timing && timing.t0_send && timing.t1_send) {
          // Get pending receiver timing from a Map
          const pendingTiming = pendingE2ETimingRef.current.get(messageId)

          if (pendingTiming) {
            // Compile complete E2E record
            const e2eRecord = {
              messageId: messageId,
              channelId: pendingTiming.channelId,
              text: pendingTiming.text,
              t0_send: timing.t0_send,
              t1_send: timing.t1_send,
              t_api: pendingTiming.t_api,
              t_db_start: pendingTiming.t_db_start,
              t_db_end: pendingTiming.t_db_end,
              t_md_start: pendingTiming.t_md_start,
              t_md_end: pendingTiming.t_md_end,
              t_ws_broadcast: pendingTiming.t_ws_broadcast,
              t2_recv: pendingTiming.t2_recv,
              t3_recv: pendingTiming.t3_recv,
              t4_recv: pendingTiming.t4_recv
            }

            const totalE2E = pendingTiming.t4_recv - timing.t0_send

            console.log('[RECEIVER - TIMING UPDATE]', {
              messageId,
              totalE2E: totalE2E.toFixed(2) + 'ms'
            })

            // Send to E2E latency endpoint
            fetch('http://localhost:9600/api/latency/e2e/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(e2eRecord)
            }).catch(err => console.warn('Failed to record E2E latency:', err))

            // Clean up
            pendingE2ETimingRef.current.delete(messageId)
          }
        }
      } else if (data.type === 'ai_start' && selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current) {
        // AI started responding - add empty streaming message
        console.log('[Comms-App] 🤖 AI streaming started:', data.message.id)
        setChannelMessages(prev => [...prev, data.message])
        userHasScrolledRef.current = false // Enable auto-scroll
      } else if (data.type === 'ai_chunk' && selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current) {
        // AI chunk received - update message text in real-time
        console.log('[Comms-App] 📝 AI chunk received:', data.chunk.substring(0, 30))
        setChannelMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, text: data.full_text }
            : msg
        ))
        userHasScrolledRef.current = false // Keep scrolling with streaming text
      } else if (data.type === 'ai_complete' && selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current) {
        // AI response complete - update with final tokens
        console.log('[Comms-App] ✅ AI streaming complete:', data.message_id)
        setChannelMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, streaming: false, tokens_input: data.tokens?.input, tokens_output: data.tokens?.output }
            : msg
        ))
        userHasScrolledRef.current = false // Final scroll to show tokens
      } else if (data.type === 'ai_error' && selectedChannelTypeRef.current === 'channel' && data.channel_id === selectedChannelRef.current) {
        // AI error - remove the empty streaming message
        console.log('[Comms-App] ❌ AI streaming error:', data.message_id)
        setChannelMessages(prev => prev.filter(msg => msg.id !== data.message_id))
      } else if (data.type === 'new_chat') {
        // Handle new chat notification from login-app or other clients
        console.log('[Comms-App] 📢 Received new chat notification:', data.chat)

        // Check if chat already exists and add to the top of the list
        setAiChats(prevChats => {
          if (prevChats.some(c => c.id === data.chat.id)) {
            return prevChats
          }
          // Add new chat to the top of the list
          return [data.chat, ...prevChats]
        })
      } else if (data.type === 'visitor:connected') {
        // Handle new visitor connection
        console.log('[Comms-App] 👁️ New visitor connected:', data.session)
        setVisitorSessions(prev => {
          // Check if already exists
          if (prev.some(s => s.id === data.session.id)) {
            return prev
          }
          return [...prev, data.session]
        })
      } else if (data.type === 'visitor:disconnected') {
        // Handle visitor disconnection
        console.log('[Comms-App] 👋 Visitor disconnected:', data.sessionId)
        setVisitorSessions(prev =>
          prev.map(s => s.id === data.sessionId
            ? { ...s, status: 'disconnected' as const }
            : s
          )
        )
      } else if (data.type === 'visitor:updated') {
        // Handle visitor session updates
        console.log('[Comms-App] 🔄 Visitor updated:', data.sessionId, data.updates)
        setVisitorSessions(prev =>
          prev.map(s => s.id === data.sessionId
            ? { ...s, ...data.updates }
            : s
          )
        )
      } else if (data.type === 'visitor:message') {
        // Handle message from visitor
        console.log('[Comms-App] 💬 Visitor message:', data.sessionId, data.message)

        // Increment unread count if not viewing this visitor
        setVisitorSessions(prev =>
          prev.map(s => {
            if (s.id === data.sessionId) {
              const isViewing = selectedChannelTypeRef.current === 'visitor' && selectedVisitorIdRef.current === s.id
              return {
                ...s,
                unreadCount: isViewing ? 0 : (s.unreadCount || 0) + 1,
                lastActivity: data.message.timestamp
              }
            }
            return s
          })
        )

        // If we're viewing this visitor, add message to the conversation
        if (selectedChannelTypeRef.current === 'visitor' && selectedVisitorIdRef.current === data.sessionId) {
          console.log('[Comms-App] ✅ Adding visitor message to chat (we are viewing this visitor)')
          setChannelMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m.id === data.message.id)) {
              return prev
            }
            return [...prev, data.message]
          })
        } else {
          console.log('[Comms-App] ⏭️ Not adding message to chat (different visitor or view)', {
            currentType: selectedChannelTypeRef.current,
            currentVisitor: selectedVisitorIdRef.current,
            messageFromVisitor: data.sessionId
          })
        }
      } else if (data.type === 'visitor:activity') {
        // Handle visitor activity (form field changes)
        console.log('[Comms-App] 📝 Visitor activity:', data.sessionId, data.message)

        // Update last activity
        setVisitorSessions(prev =>
          prev.map(s => s.id === data.sessionId
            ? { ...s, lastActivity: data.message.timestamp }
            : s
          )
        )

        // If we're viewing this visitor, add activity message to the conversation
        if (selectedChannelTypeRef.current === 'visitor' && selectedVisitorIdRef.current === data.sessionId) {
          setChannelMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m.id === data.message.id)) {
              return prev
            }
            return [...prev, data.message]
          })
        }
      } else if (data.type === 'visitor:typing') {
        // Handle visitor typing indicator
        // TODO: Display typing indicator in UI
        console.log('[Comms-App] ⌨️ Visitor typing:', data.sessionId, data.isTyping)
      }
    }

    ws.onerror = (error) => {
      console.error('[Comms-App] ❌ WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('[Comms-App] 🔌 WebSocket disconnected')
    }

    wsRef.current = ws

    return () => {
      // In React Strict Mode, this cleanup runs immediately after mount
      // Don't close the WebSocket - we want to keep it alive
      // Just clear the ref so the next mount can create a fresh connection if needed
      console.log('[Comms-App] 🧹 Cleanup running, but keeping WebSocket alive')
      // Don't close ws or clear wsRef - we want to reuse the connection
    }
  }, []) // Only connect once on mount

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/events?days=7&limit=100')
      const data = await response.json()
      setEvents(data.events || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch events:', error)
      setLoading(false)
    }
  }

  const fetchAllEntities = async () => {
    try {
      const sections: EntitySection[] = []

      for (const entityType of ENTITY_TYPES) {
        const response = await fetch(`http://localhost:9600/api/entities/${entityType.type}?limit=50`)
        const data = await response.json()

        sections.push({
          type: entityType.type,
          label: entityType.label,
          icon: entityType.icon,
          entities: data.entities || [],
          expanded: true
        })
      }

      setEntitySections(sections)
    } catch (error) {
      console.error('Failed to fetch entities:', error)
    }
  }

  const fetchChannels = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/channels')
      const data = await response.json()
      setChannels(data.channels || [])
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    }
  }

  const fetchVisitorSessions = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/visitor-sessions')
      const data = await response.json()
      console.log('[Comms-App] 📋 Loaded visitor sessions from database:', data.sessions?.length, 'sessions')
      console.log('[Comms-App] 📋 Sessions:', data.sessions)
      setVisitorSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch visitor sessions:', error)
    }
  }

  const loadAIChats = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/vault/chats')
      if (response.ok) {
        const data = await response.json()
        if (data.chats && data.chats.length > 0) {
          setAiChats(data.chats)
        }
      }
    } catch (error) {
      console.error('[Comms-App] Error loading AI chats:', error)
    }
  }

  const handleNewAIChat = () => {
    const newChatId = `chat_${Date.now()}`
    setCurrentAIChatId(newChatId)
    setSelectedChannelType('channel')
    setSelectedChannel(newChatId)
    setChannelMessages([]) // Start with empty messages
  }

  const handleChatCreated = (chatId: string, firstMessage: string) => {
    // Check if chat already exists in list
    if (aiChats.some(c => c.id === chatId)) {
      return
    }

    // Add new chat to list with title from first message
    const newChat = {
      id: chatId,
      title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : ''),
      timestamp: new Date().toISOString(),
      isPinned: false
    }
    setAiChats(prev => [newChat, ...prev])
  }

  const saveMessagesToVault = async (chatId: string, messages: ChannelMessage[]) => {
    // Convert messages to markdown format
    const markdown = messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleString()
      const author = msg.author_name
      const text = msg.text
      const tokens = msg.tokens ? `\n\n_Tokens: ${msg.tokens.input + msg.tokens.output}_` : ''

      return `## ${author} (${timestamp})\n\n${text}${tokens}`
    }).join('\n\n---\n\n')

    const content = `# Chat: ${chatId}\n\n${markdown}`

    try {
      const response = await fetch('http://localhost:9600/api/vault/chats/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          content,
          messagesJson: messages // Also save JSON for easy loading
        })
      })

      if (response.ok) {
        console.log(`[Comms-App] Saved to vault: vault/chats/${chatId}.md`)
      }
    } catch (error) {
      console.log('[Comms-App] Could not save to vault:', error)
    }
  }

  const fetchChannelMessages = async (channelId: string, isInitialLoad = false) => {
    try {
      // Check if this is an AI chat (starts with 'chat_')
      if (channelId.startsWith('chat_')) {
        // Try to load from vault
        try {
          const vaultResponse = await fetch(`http://localhost:9600/api/vault/chats/${channelId}`)
          if (vaultResponse.ok) {
            const vaultData = await vaultResponse.json()
            if (vaultData.messages && vaultData.messages.length > 0) {
              console.log(`[Comms-App] Loaded ${vaultData.messages.length} messages from vault`)
              setChannelMessages(vaultData.messages)
              setHasMoreMessages(false)

              if (isInitialLoad) {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
                }, 100)
              }
              return
            }
          }
        } catch (error) {
          // Silently handle 404 - new chat doesn't exist yet
          console.log(`[Comms-App] New chat ${channelId} - starting empty`)
        }
        // If no messages in vault or 404, start empty
        setChannelMessages([])
        setHasMoreMessages(false)
        return
      }

      // Regular channel - load from database
      const limit = 50 // Load 50 messages at a time
      const response = await fetch(`http://localhost:9600/api/channels/${channelId}/messages?limit=${limit}`)
      const data = await response.json()
      const messages = data.messages || []

      setChannelMessages(messages)
      setHasMoreMessages(messages.length === limit)

      // Scroll to bottom on initial load
      if (isInitialLoad) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        }, 100)
      }
    } catch (error) {
      console.error('Failed to fetch channel messages:', error)
    }
  }

  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasMoreMessages || channelMessages.length === 0) return

    isLoadingMoreRef.current = true
    setLoadingOlderMessages(true)

    try {
      const container = messagesContainerRef.current
      if (!container) return

      // Save current scroll position
      const oldScrollHeight = container.scrollHeight
      const oldScrollTop = container.scrollTop

      // Get the oldest message timestamp
      const oldestMessage = channelMessages[0]
      const before = oldestMessage.timestamp

      const limit = 50
      const response = await fetch(
        `http://localhost:9600/api/channels/${selectedChannel}/messages?limit=${limit}&before=${before}`
      )
      const data = await response.json()
      const olderMessages = data.messages || []

      if (olderMessages.length > 0) {
        setChannelMessages(prev => [...olderMessages, ...prev])
        setHasMoreMessages(olderMessages.length === limit)

        // Restore scroll position after new messages are added
        setTimeout(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
        }, 0)
      } else {
        setHasMoreMessages(false)
      }
    } catch (error) {
      console.error('Failed to load older messages:', error)
    } finally {
      setLoadingOlderMessages(false)
      isLoadingMoreRef.current = false
    }
  }

  const switchToChannel = (channelId: string) => {
    setSelectedChannel(channelId)
    setSelectedChannelType('channel')
    fetchChannelMessages(channelId, true)
  }

  const handleVisitorClick = async (sessionId: string) => {
    setSelectedVisitorId(sessionId)
    setSelectedChannelType('visitor')
    setSelectedChannel('')  // Clear channel selection
    setEntityMarkdown(null)

    // Clear unread count
    setVisitorSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, unreadCount: 0 } : s)
    )

    // Fetch visitor messages
    try {
      const response = await fetch(`http://localhost:9600/api/visitor-sessions/${sessionId}/messages`)
      const data = await response.json()
      setChannelMessages(data.messages || [])
      setHasMoreMessages(false)

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }, 100)
    } catch (error) {
      console.error('Failed to fetch visitor messages:', error)
      setChannelMessages([])
    }
  }

  const fetchEntityMarkdown = async (entityId: string) => {
    try {
      // Find entity to get its type
      const entity = getEntityById(entityId)
      if (!entity) {
        setEntityMarkdown(null)
        return
      }

      // Get entity type from the sections
      let entityType = ''
      for (const section of entitySections) {
        if (section.entities.some(e => e.id === entityId)) {
          entityType = section.type
          break
        }
      }

      if (!entityType) {
        setEntityMarkdown(null)
        return
      }

      const response = await fetch(`http://localhost:9600/api/documents/by-entity/${entityType}/${entityId}`)
      if (response.ok) {
        const data = await response.json()
        // Combine frontmatter and content to show the full markdown file
        const frontmatterYaml = Object.entries(data.frontmatter)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
        const fullMarkdown = `---\n${frontmatterYaml}\n---\n\n${data.content}`
        setEntityMarkdown(fullMarkdown)
      } else {
        setEntityMarkdown(null)
      }
    } catch (error) {
      console.error('Failed to fetch entity markdown:', error)
      setEntityMarkdown(null)
    }
  }

  const addToHistory = (message: string) => {
    if (!message.trim()) return

    setMessageHistory(prev => {
      // Don't add duplicates if it's the same as the last message
      if (prev.length > 0 && prev[prev.length - 1] === message) {
        return prev
      }

      const newHistory = [...prev, message]
      // Keep last 100 messages
      const limitedHistory = newHistory.slice(-100)

      // Save to localStorage
      localStorage.setItem('comms-app-message-history', JSON.stringify(limitedHistory))

      return limitedHistory
    })

    // Reset history navigation
    setHistoryIndex(-1)
    setTempMessage('')
  }

  const sendChannelMessage = async () => {
    const currentText = messageInputRef.current?.value || ''
    if (!currentText.trim() || sending || selectedChannelType !== 'channel') return

    const trimmedText = currentText.trim()

    // Add to history
    addToHistory(trimmedText)

    // Handle unix mode - all messages are commands (no prefix needed)
    if (messageMode === 'unix') {
      const command = trimmedText
      if (!command) return

      setSending(true)

      try {
        const response = await fetch('http://localhost:9600/api/command/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command })
        })

        const data = await response.json()

        if (response.ok) {
          // Display command output as a system message
          const outputMessage = `$ ${command}\n${data.output}`

          // Optimistically add to local UI immediately
          const newMessage: ChannelMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            channel_id: selectedChannel,
            author: 'system',
            author_name: 'Shell',
            text: outputMessage,
            timestamp: new Date().toISOString()
          }
          setChannelMessages(prev => [...prev, newMessage])

          // Save command and output as a message
          await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: outputMessage,
              author: 'system',
              author_name: 'Shell'
            })
          })
        } else {
          // Display error
          const errorMessage = `$ ${command}\nError: ${data.error || 'Command execution failed'}`

          // Optimistically add error to local UI immediately
          const errorMsg: ChannelMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            channel_id: selectedChannel,
            author: 'system',
            author_name: 'Shell',
            text: errorMessage,
            timestamp: new Date().toISOString()
          }
          setChannelMessages(prev => [...prev, errorMsg])

          await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: errorMessage,
              author: 'system',
              author_name: 'Shell'
            })
          })
        }

        // Clear input on success
        if (messageInputRef.current) messageInputRef.current.value = ''

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error executing command:', error)
        alert('Failed to execute command. Please try again.')
      } finally {
        setSending(false)
      }
      return
    }

    // Handle ai mode - all messages go to AI (no prefix needed)
    if (messageMode === 'ai') {
      setSending(true)
      setIsAIStreaming(true)
      setAiStreamingMessage('')
      aiStreamingMessageRef.current = ''

      try {
        // Determine if this is an AI chat session
        const isAIChatSession = selectedChannel.startsWith('chat_') || currentAIChatId
        const chatId = currentAIChatId || (selectedChannel.startsWith('chat_') ? selectedChannel : null)

        // Check if this is the first message in a new chat
        const isFirstMessage = isAIChatSession && channelMessages.length === 0

        // Create user message
        const userMessage: ChannelMessage = {
          id: `msg_${Date.now()}`,
          channel_id: selectedChannel,
          author: 'user',
          author_name: getUserName(),
          text: trimmedText,
          timestamp: new Date().toISOString()
        }

        // Add user message to display immediately
        setChannelMessages(prev => [...prev, userMessage])

        // Save user message to backend (for non-AI-chat channels) or will be saved to vault
        if (!isAIChatSession) {
          await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: trimmedText,
              author: 'user',
              author_name: getUserName()
            })
          })
        }

        // Get chat history to send to AI
        const history = [...channelMessages, userMessage].map(msg => ({
          id: msg.id,
          text: msg.text,
          author_name: msg.author_name,
          timestamp: msg.timestamp,
          type: msg.author === 'ai' ? 'ai' as const : 'user' as const
        }))

        await sendAIMessage(
          trimmedText,
          history,
          (chunk) => {
            aiStreamingMessageRef.current += chunk
            setAiStreamingMessage(aiStreamingMessageRef.current)
          },
          async (tokens) => {
            // On complete, save the AI message
            if (tokens) {
              console.log(`[AI Tokens] Channel ${selectedChannel}: ${tokens.input} in + ${tokens.output} out = ${tokens.input + tokens.output} total`)
            }
            const completeMessage = aiStreamingMessageRef.current

            const aiMessage: ChannelMessage = {
              id: `msg_${Date.now()}`,
              channel_id: selectedChannel,
              author: 'ai',
              author_name: 'Cohere',
              text: completeMessage,
              timestamp: new Date().toISOString(),
              tokens: tokens
            }

            setChannelMessages(prev => [...prev, aiMessage])
            setIsAIStreaming(false)
            setAiStreamingMessage('')
            aiStreamingMessageRef.current = ''
            if (messageInputRef.current) messageInputRef.current.value = ''

            // Save to vault for AI chat sessions
            if (isAIChatSession && chatId) {
              const messagesForVault = [...channelMessages, userMessage, aiMessage]
              await saveMessagesToVault(chatId, messagesForVault)

              // If first message, notify to add chat to list
              if (isFirstMessage) {
                handleChatCreated(chatId, trimmedText)
              }
            } else {
              // Save to channel database for regular channels
              try {
                await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: completeMessage,
                    author: 'ai',
                    author_name: 'Cohere',
                    tokens: tokens ? { input: tokens.input, output: tokens.output } : undefined
                  })
                })
              } catch (error) {
                console.error('Error saving AI message:', error)
              }
            }
          }
        )

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error getting AI response:', error)
        alert('Failed to get AI response. Please try again.')
        setIsAIStreaming(false)
        setAiStreamingMessage('')
      } finally {
        setSending(false)
      }
      return
    }

    // Chat mode - check for prefixes
    // Check if this is a shell command (starts with .)
    if (trimmedText.startsWith('.')) {
      const command = trimmedText.slice(1).trim() // Remove "." prefix
      if (!command) return

      setSending(true)

      try {
        const response = await fetch('http://localhost:9600/api/command/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command })
        })

        const data = await response.json()

        if (response.ok) {
          // Display command output as a system message
          const outputMessage = `$ ${command}\n${data.output}`

          // Optimistically add to local UI immediately
          const newMessage: ChannelMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            channel_id: selectedChannel,
            author: 'system',
            author_name: 'Shell',
            text: outputMessage,
            timestamp: new Date().toISOString()
          }
          setChannelMessages(prev => [...prev, newMessage])

          // Save command and output as a message
          await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: outputMessage,
              author: 'system',
              author_name: 'Shell'
            })
          })
        } else {
          // Display error
          const errorMessage = `$ ${command}\nError: ${data.error || 'Command execution failed'}`

          // Optimistically add error to local UI immediately
          const errorMsg: ChannelMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            channel_id: selectedChannel,
            author: 'system',
            author_name: 'Shell',
            text: errorMessage,
            timestamp: new Date().toISOString()
          }
          setChannelMessages(prev => [...prev, errorMsg])

          await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: errorMessage,
              author: 'system',
              author_name: 'Shell'
            })
          })
        }

        // Clear input on success
        if (messageInputRef.current) messageInputRef.current.value = ''

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error executing command:', error)
        alert('Failed to execute command. Please try again.')
      } finally {
        setSending(false)
      }
      return
    }

    // Handle Cohere DM - direct chat with persistence
    if (selectedChannel === 'dm_cohere') {
      setSending(true)
      setIsAIStreaming(true)
      setAiStreamingMessage('')
      aiStreamingMessageRef.current = ''

      try{
        // First, save the user message to database
        await fetch(`http://localhost:9600/api/channels/dm_cohere/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: trimmedText,
            author: 'user',
            author_name: getUserName()
          })
        })

        // Build history from all Cohere DM messages (including message we just saved)
        const history = channelMessages.map(msg => ({
          id: msg.id,
          text: msg.text,
          author_name: msg.author_name,
          timestamp: msg.timestamp,
          type: msg.author === 'ai' ? 'ai' as const : 'user' as const
        }))

        // Add current message to history
        history.push({
          id: `temp_${Date.now()}`,
          text: trimmedText,
          author_name: getUserName(),
          timestamp: new Date().toISOString(),
          type: 'user' as const
        })

        // Send to AI with full Cohere chat history
        await sendAIMessage(
          trimmedText,
          history,
          (chunk) => {
            aiStreamingMessageRef.current += chunk
            setAiStreamingMessage(aiStreamingMessageRef.current)
          },
          async (tokens) => {
            // On complete, save AI message to database
            if (tokens) {
              console.log(`[AI Tokens] DM Cohere: ${tokens.input} in + ${tokens.output} out = ${tokens.input + tokens.output} total`)
            }
            const completeMessage = aiStreamingMessageRef.current
            setIsAIStreaming(false)
            setAiStreamingMessage('')
            aiStreamingMessageRef.current = ''
            if (messageInputRef.current) messageInputRef.current.value = ''

            try {
              await fetch(`http://localhost:9600/api/channels/dm_cohere/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  text: completeMessage,
                  author: 'ai',
                  author_name: 'Cohere',
                  tokens: tokens ? {
                    input: tokens.input,
                    output: tokens.output
                  } : undefined
                })
              })
            } catch (error) {
              console.error('Error saving AI message:', error)
            }
          }
        )

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error getting Cohere response:', error)
        alert('Failed to get Cohere response. Please try again.')
        setIsAIStreaming(false)
        setAiStreamingMessage('')
      } finally {
        setSending(false)
      }
      return
    }

    // Check if this is an AI request (supports %co, %ask, %explain, %summarize, and legacy @c)
    const aiCommand = detectAICommand(trimmedText)
    if (aiCommand.isAI) {
      if (!aiCommand.query) return

      // Show deprecation notice for legacy @c prefix (one-time)
      if (aiCommand.isLegacy && !hasShownDeprecationNotice) {
        console.warn('⚠️ [@c is deprecated] Please use %co instead. Examples: %co <query>, %ask <query>, %explain <topic>, %summarize <text>')
        setHasShownDeprecationNotice(true)
        localStorage.setItem('comms-app-shown-ai-prefix-deprecation', 'true')
      }

      setSending(true)
      setIsAIStreaming(true)
      setAiStreamingMessage('') // Will show loading indicator
      aiStreamingMessageRef.current = ''

      try {
        // First, save the user's AI message to the channel
        await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: trimmedText, // Save the full message including "@c "
            author: 'user',
            author_name: getUserName()
          })
        })

        // Get chat history to send to AI (including the message we just saved)
        const history = channelMessages.map(msg => ({
          id: msg.id,
          text: msg.text,
          author_name: msg.author_name,
          timestamp: msg.timestamp,
          type: msg.author === 'ai' ? 'ai' as const : 'user' as const
        }))

        // Add the user's current message to history for the AI
        history.push({
          id: `temp_${Date.now()}`,
          text: trimmedText,
          author_name: getUserName(),
          timestamp: new Date().toISOString(),
          type: 'user' as const
        })

        // Construct final query with system prompt if applicable
        const finalQuery = aiCommand.systemPrompt
          ? `${aiCommand.systemPrompt} ${aiCommand.query}`
          : aiCommand.query

        await sendAIMessage(
          finalQuery,
          history,
          (chunk) => {
            aiStreamingMessageRef.current += chunk
            setAiStreamingMessage(aiStreamingMessageRef.current)
          },
          async (tokens) => {
            // On complete, save the AI message to the channel with token data
            if (tokens) {
              console.log(`[AI Tokens] Channel ${selectedChannel}: ${tokens.input} in + ${tokens.output} out = ${tokens.input + tokens.output} total`)
            }
            const completeMessage = aiStreamingMessageRef.current
            setIsAIStreaming(false)
            setAiStreamingMessage('')
            aiStreamingMessageRef.current = ''
            if (messageInputRef.current) messageInputRef.current.value = ''

            try {
              await fetch(`http://localhost:9600/api/channels/${selectedChannel}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  text: completeMessage,
                  author: 'ai',
                  author_name: 'AI Assistant',
                  tokens: tokens ? {
                    input: tokens.input,
                    output: tokens.output
                  } : undefined
                })
              })
            } catch (error) {
              console.error('Error saving AI message:', error)
            }
          }
        )

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error getting AI response:', error)
        alert('Failed to get AI response. Please try again.')
        setIsAIStreaming(false)
        setAiStreamingMessage('')
      } finally {
        setSending(false)
      }
      return
    }

    // Handle @Cohere special case - create new chat session
    if (selectedChannel === '@Cohere') {
      // Create a new chat session automatically
      const newChatId = `chat_${Date.now()}`
      setCurrentAIChatId(newChatId)
      setSelectedChannel(newChatId)

      // Now send the message to the new chat in AI mode
      setSending(true)
      setIsAIStreaming(true)
      setAiStreamingMessage('')
      aiStreamingMessageRef.current = ''

      try {
        // Create user message
        const userMessage: ChannelMessage = {
          id: `msg_${Date.now()}`,
          channel_id: newChatId,
          author: 'user',
          author_name: getUserName(),
          text: trimmedText,
          timestamp: new Date().toISOString()
        }

        // Add user message to display immediately
        setChannelMessages([userMessage])

        // Get chat history to send to AI
        const history = [userMessage].map(msg => ({
          id: msg.id,
          text: msg.text,
          author_name: msg.author_name,
          timestamp: msg.timestamp,
          type: 'user' as const
        }))

        await sendAIMessage(
          trimmedText,
          history,
          (chunk) => {
            aiStreamingMessageRef.current += chunk
            setAiStreamingMessage(aiStreamingMessageRef.current)
          },
          async (tokens) => {
            const completeMessage = aiStreamingMessageRef.current

            const aiMessage: ChannelMessage = {
              id: `msg_${Date.now()}`,
              channel_id: newChatId,
              author: 'ai',
              author_name: 'Cohere',
              text: completeMessage,
              timestamp: new Date().toISOString(),
              tokens: tokens
            }

            setChannelMessages([userMessage, aiMessage])
            setIsAIStreaming(false)
            setAiStreamingMessage('')
            aiStreamingMessageRef.current = ''
            if (messageInputRef.current) messageInputRef.current.value = ''

            // Save to vault
            await saveMessagesToVault(newChatId, [userMessage, aiMessage])

            // Add chat to list
            handleChatCreated(newChatId, trimmedText)
          }
        )

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)
      } catch (error) {
        console.error('Error getting AI response:', error)
        alert('Failed to get AI response. Please try again.')
        setIsAIStreaming(false)
        setAiStreamingMessage('')
      } finally {
        setSending(false)
      }
      return
    }

    // Regular message flow
    const t0_send = performance.now()
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    setSending(true)

    try {
      const endpoint = `http://localhost:9600/api/channels/${selectedChannel}/messages`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: trimmedText,
          author: 'user',
          author_name: getUserName(),
          timing: {
            t0: t0_send,
            messageId: messageId
          }
        })
      })

      // T1: Record response received time
      const t1_send = performance.now()

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      // Note: WebSocket broadcast will add the message to UI for all clients
      // including the sender, so no need for optimistic update here

      // Send t1_send to server for E2E correlation
      if (data.timing) {
        console.log('[SENDER]', {
          messageId,
          text: trimmedText,
          senderLatency: (t1_send - t0_send).toFixed(2) + 'ms'
        })

        // Send sender timing to server so receivers can access it
        fetch('http://localhost:9600/api/latency/e2e/sender-timing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            t1_send
          })
        }).catch(err => console.warn('Failed to send sender timing:', err))
      }

      // Clear input on success
      if (messageInputRef.current) messageInputRef.current.value = ''

      // Maintain focus on the input
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const createChannel = async (name: string, description: string) => {
    try {
      const response = await fetch('http://localhost:9600/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
      })

      if (!response.ok) {
        throw new Error('Failed to create channel')
      }

      // Refresh channels list
      await fetchChannels()
    } catch (error) {
      console.error('Error creating channel:', error)
      alert('Failed to create channel. Please try again.')
    }
  }

  const toggleSection = (sectionType: string) => {
    setEntitySections(sections =>
      sections.map(section =>
        section.type === sectionType
          ? { ...section, expanded: !section.expanded }
          : section
      )
    )
  }

  const getFilteredEvents = () => {
    if (selectedChannel === 'all') {
      return events
    }

    // Filter events by entity_id
    return events.filter(event => event.entity_id === selectedChannel)
  }

  const getEntityById = (entityId: string): Entity | null => {
    for (const section of entitySections) {
      const entity = section.entities.find(e => e.id === entityId)
      if (entity) return entity
    }
    return null
  }

  const getChannelInfo = () => {
    // Handle chat channels
    if (selectedChannelType === 'channel') {
      // Handle Cohere DM
      if (selectedChannel === 'dm_cohere') {
        return {
          name: '@Cohere',
          description: 'Direct chat with Cohere AI',
          icon: '🤖'
        }
      }

      const channel = channels.find(c => c.id === selectedChannel)
      if (channel) {
        return {
          name: `# ${channel.name}`,
          description: channel.description || `Chat channel for ${channel.name}`,
          icon: '#'
        }
      }
      return {
        name: '# unknown',
        description: 'Unknown channel',
        icon: '?'
      }
    }

    // Handle object channels
    if (selectedChannel === 'all') {
      return {
        name: '# all',
        description: 'All CRM events and updates',
        icon: '#'
      }
    }

    const entity = getEntityById(selectedChannel)
    if (entity) {
      const section = entitySections.find(s =>
        s.entities.some(e => e.id === selectedChannel)
      )
      return {
        name: entity.name,
        description: `All events for this ${section?.label.slice(0, -1) || 'entity'}`,
        icon: section?.icon || '📋'
      }
    }

    return {
      name: '# unknown',
      description: 'Unknown channel',
      icon: '?'
    }
  }

  const getEventCountForEntity = (entityId: string): number => {
    return events.filter(event => event.entity_id === entityId).length
  }

  const togglePinChannel = (channelId: string) => {
    setPinnedChannels(prev => {
      const newPinned = prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]

      localStorage.setItem('comms-app-pinned-channels', JSON.stringify(newPinned))
      return newPinned
    })
  }

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newCollapsed = new Set(prev)
      if (newCollapsed.has(sectionId)) {
        newCollapsed.delete(sectionId)
      } else {
        newCollapsed.add(sectionId)
      }
      localStorage.setItem('comms-app-collapsed-sections', JSON.stringify(Array.from(newCollapsed)))
      return newCollapsed
    })
  }

  const isSectionCollapsed = (sectionId: string): boolean => {
    return collapsedSections.has(sectionId)
  }

  const isPinned = (channelId: string): boolean => {
    return pinnedChannels.includes(channelId)
  }

  const getPinnedEntities = () => {
    const pinned: Array<{ entity: Entity; section: EntitySection }> = []

    pinnedChannels.forEach(channelId => {
      for (const section of entitySections) {
        const entity = section.entities.find(e => e.id === channelId)
        if (entity) {
          pinned.push({ entity, section })
          break
        }
      }
    })

    return pinned
  }

  const getRecentEntities = () => {
    // Get the most recent event timestamp for each entity
    const entityLastUpdate = new Map<string, string>()

    events.forEach(event => {
      if (event.entity_id) {
        const currentTimestamp = entityLastUpdate.get(event.entity_id)
        if (!currentTimestamp || event.timestamp > currentTimestamp) {
          entityLastUpdate.set(event.entity_id, event.timestamp)
        }
      }
    })

    // Build array of entities with their last update times
    const entitiesWithTime: Array<{ entity: Entity; section: EntitySection; timestamp: string }> = []

    for (const section of entitySections) {
      for (const entity of section.entities) {
        const timestamp = entityLastUpdate.get(entity.id)
        if (timestamp) {
          entitiesWithTime.push({ entity, section, timestamp })
        }
      }
    }

    // Sort by timestamp descending and take top 5
    return entitiesWithTime
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date().getTime()
    const then = new Date(timestamp).getTime()
    const diffMs = now - then
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  // Linkify URLs in message text
  const renderMessageWithLinks = (text: string): React.ReactNode => {
    // Regex to detect URLs (http, https)
    const urlRegex = /(https?:\/\/[^\s]+)/g

    // Split text by URLs
    const parts = text.split(urlRegex)

    return parts.map((part, index) => {
      // Check if this part is a URL
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="message-link"
            onClick={(e) => {
              e.stopPropagation()
              console.log('Link clicked:', part)
              // TODO: Track link in database
            }}
          >
            {part}
          </a>
        )
      }
      // Return plain text
      return part
    })
  }

  const getEventEmoji = (event: Event) => {
    if (event.status === 'failed') return '❌'
    if (event.status === 'pending') return '⏳'

    switch (event.type) {
      case 'create': return '✨'
      case 'update': return '✏️'
      case 'delete': return '🗑️'
      case 'bulk': return '📦'
      default: return '📝'
    }
  }

  const getEventMessage = (event: Event) => {
    const action = event.type.charAt(0).toUpperCase() + event.type.slice(1)
    const entity = event.entity_type || 'item'

    if (event.status === 'failed') {
      return `${action} ${entity} failed${event.error ? ': ' + event.error : ''}`
    }

    return `${action} ${entity}`
  }

  const getEntityDetails = (entityId: string): Entity | null => {
    for (const section of entitySections) {
      const entity = section.entities.find(e => e.id === entityId)
      if (entity) return entity
    }
    return null
  }

  const groupEventsByDate = (events: Event[]) => {
    // First, sort events chronologically (oldest first)
    const sortedEvents = [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const groups: { [key: string]: Event[] } = {}
    const dateOrder: string[] = []

    sortedEvents.forEach(event => {
      const date = formatDate(event.timestamp)
      if (!groups[date]) {
        groups[date] = []
        dateOrder.push(date)
      }
      groups[date].push(event)
    })

    // Return groups with date order preserved (oldest date first)
    const orderedGroups: { [key: string]: Event[] } = {}
    dateOrder.forEach(date => {
      orderedGroups[date] = groups[date]
    })

    return orderedGroups
  }

  const sendMessage = async () => {
    const currentText = messageInputRef.current?.value || ''
    if (!currentText.trim() || sending) return

    const trimmedText = currentText.trim()

    // Reset manual scroll flag so we scroll to bottom after sending
    userHasScrolledRef.current = false

    // Handle visitor messages
    if (selectedChannelType === 'visitor' && selectedVisitorId) {
      setSending(true)
      try {
        const response = await fetch(`http://localhost:9600/api/visitor-sessions/${selectedVisitorId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmedText,
            author_name: getUserName()
          })
        })

        if (!response.ok) throw new Error('Failed to send message')

        const data = await response.json()

        // Add message to UI
        setChannelMessages(prev => [...prev, data.message])

        if (messageInputRef.current) messageInputRef.current.value = ''

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
          messageInputRef.current?.focus()
        }, 100)

        setSending(false)
        return
      } catch (error) {
        console.error('Error sending visitor message:', error)
        alert('Failed to send message. Please try again.')
        setSending(false)
        return
      }
    }

    // Add to history for object channels too
    if (selectedChannelType !== 'channel') {
      addToHistory(trimmedText)
    }

    // Route to correct send function based on channel type
    if (selectedChannelType === 'channel') {
      await sendChannelMessage()
      // Scroll to bottom after sending message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        // Ensure focus returns to input after scroll
        messageInputRef.current?.focus()
      }, 100)
    } else {
      // Object channel (entity) message
      if (selectedChannel === 'all') return

      // Handle ai mode - all messages go to AI (no prefix needed)
      if (messageMode === 'ai') {
        setSending(true)
        setIsAIStreaming(true)
        setAiStreamingMessage('') // Will show loading indicator
        aiStreamingMessageRef.current = ''

        try {
          // First, save the user's message
          await fetch('http://localhost:9600/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              entity_id: selectedChannel,
              entity_type: 'message',
              text: trimmedText,
              author: 'user',
              author_name: getUserName()
            })
          })

          // Build context from entity markdown and events
          let contextMessages: Array<{ id: string; text: string; author_name: string; timestamp: string; type: 'ai' | 'user' }> = []

          // Add entity markdown as context if available
          if (entityMarkdown) {
            contextMessages.push({
              id: 'context_markdown',
              text: `[Entity Information]\n\n${entityMarkdown}`,
              author_name: 'System',
              timestamp: new Date().toISOString(),
              type: 'user' as const
            })
          }

          // Add recent user and AI messages from events (filter out tool-related messages)
          const messageEvents = filteredEvents.filter(event => event.data?.message_type === 'user_message')
          messageEvents.forEach(event => {
            // Only include user messages and AI text messages (no tool calls)
            const isAI = event.data?.author === 'ai'
            const text = event.data?.text || ''

            // Skip if this is an AI message but might contain tool calls or is empty
            if (isAI && !text.trim()) return

            contextMessages.push({
              id: event.event_id,
              text: text,
              author_name: event.data?.author_name || 'User',
              timestamp: event.timestamp,
              type: isAI ? 'ai' as const : 'user' as const
            })
          })

          await sendAIMessage(
            trimmedText,
            contextMessages,
            (chunk) => {
              aiStreamingMessageRef.current += chunk
              setAiStreamingMessage(aiStreamingMessageRef.current)
            },
            async (tokens) => {
              // On complete, save the AI message with token data
              if (tokens) {
                console.log(`[AI Tokens] Entity ${selectedChannel}: ${tokens.input} in + ${tokens.output} out = ${tokens.input + tokens.output} total`)
              }
              const completeMessage = aiStreamingMessageRef.current
              setIsAIStreaming(false)
              setAiStreamingMessage('')
              aiStreamingMessageRef.current = ''
              if (messageInputRef.current) messageInputRef.current.value = ''

              try {
                await fetch('http://localhost:9600/api/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    entity_id: selectedChannel,
                    entity_type: 'message',
                    text: completeMessage,
                    author: 'ai',
                    author_name: 'AI Assistant',
                    tokens: tokens ? {
                      input: tokens.input,
                      output: tokens.output
                    } : undefined
                  })
                })

                // Refresh events to show new messages
                fetchEvents()
                // Scroll to bottom after AI response
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
                }, 100)
              } catch (error) {
                console.error('Error saving AI message:', error)
              }
            }
          )

          // Maintain focus on the input
          setTimeout(() => {
            messageInputRef.current?.focus()
          }, 0)
        } catch (error) {
          console.error('Error getting AI response:', error)
          alert('Failed to get AI response. Please try again.')
          setIsAIStreaming(false)
          setAiStreamingMessage('')
        } finally {
          setSending(false)
        }
        return
      }

      // Chat mode - check if this is an AI request (supports %co, %ask, %explain, %summarize, and legacy @c)
      const aiCommand = detectAICommand(trimmedText)
      if (aiCommand.isAI) {
        if (!aiCommand.query) return

        // Show deprecation notice for legacy @c prefix (one-time)
        if (aiCommand.isLegacy && !hasShownDeprecationNotice) {
          console.warn('⚠️ [@c is deprecated] Please use %co instead. Examples: %co <query>, %ask <query>, %explain <topic>, %summarize <text>')
          setHasShownDeprecationNotice(true)
          localStorage.setItem('comms-app-shown-ai-prefix-deprecation', 'true')
        }

        setSending(true)
        setIsAIStreaming(true)
        setAiStreamingMessage('') // Will show loading indicator
        aiStreamingMessageRef.current = ''

        try {
          // First, save the user's AI message
          await fetch('http://localhost:9600/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              entity_id: selectedChannel,
              entity_type: 'message',
              text: trimmedText,
              author: 'user',
              author_name: getUserName()
            })
          })

          // Build context from entity markdown and events
          let contextMessages: Array<{ id: string; text: string; author_name: string; timestamp: string; type: 'ai' | 'user' }> = []

          // Add entity markdown as context if available
          if (entityMarkdown) {
            contextMessages.push({
              id: 'context_markdown',
              text: `[Entity Information]\n\n${entityMarkdown}`,
              author_name: 'System',
              timestamp: new Date().toISOString(),
              type: 'user' as const
            })
          }

          // Add recent user and AI messages from events (filter out tool-related messages)
          const messageEvents = filteredEvents.filter(event => event.data?.message_type === 'user_message')
          messageEvents.forEach(event => {
            // Only include user messages and AI text messages (no tool calls)
            const isAI = event.data?.author === 'ai'
            const text = event.data?.text || ''

            // Skip if this is an AI message but might contain tool calls or is empty
            if (isAI && !text.trim()) return

            contextMessages.push({
              id: event.event_id,
              text: text,
              author_name: event.data?.author_name || 'User',
              timestamp: event.timestamp,
              type: isAI ? 'ai' as const : 'user' as const
            })
          })

          // Construct final query with system prompt if applicable
          const finalQuery = aiCommand.systemPrompt
            ? `${aiCommand.systemPrompt} ${aiCommand.query}`
            : aiCommand.query

          await sendAIMessage(
            finalQuery,
            contextMessages,
            (chunk) => {
              aiStreamingMessageRef.current += chunk
              setAiStreamingMessage(aiStreamingMessageRef.current)
            },
            async (tokens) => {
              // On complete, save the AI message with token data
              if (tokens) {
                console.log(`[AI Tokens] Entity ${selectedChannel}: ${tokens.input} in + ${tokens.output} out = ${tokens.input + tokens.output} total`)
              }
              const completeMessage = aiStreamingMessageRef.current
              setIsAIStreaming(false)
              setAiStreamingMessage('')
              aiStreamingMessageRef.current = ''
              if (messageInputRef.current) messageInputRef.current.value = ''

              try {
                await fetch('http://localhost:9600/api/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    entity_id: selectedChannel,
                    entity_type: 'message',
                    text: completeMessage,
                    author: 'ai',
                    author_name: 'AI Assistant',
                    tokens: tokens ? {
                      input: tokens.input,
                      output: tokens.output
                    } : undefined
                  })
                })

                // Refresh events to show new messages
                fetchEvents()
                // Scroll to bottom after AI response
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
                }, 100)
              } catch (error) {
                console.error('Error saving AI message:', error)
              }
            }
          )

          // Maintain focus on the input
          setTimeout(() => {
            messageInputRef.current?.focus()
          }, 0)
        } catch (error) {
          console.error('Error getting AI response:', error)
          alert('Failed to get AI response. Please try again.')
          setIsAIStreaming(false)
          setAiStreamingMessage('')
        } finally {
          setSending(false)
        }
        return
      }

      // Regular message flow for object channels
      setSending(true)

      try {
        // Get entity info
        const entity = getEntityById(selectedChannel)
        const section = entitySections.find(s =>
          s.entities.some(e => e.id === selectedChannel)
        )

        const response = await fetch('http://localhost:9600/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entity_id: selectedChannel,
            entity_type: entity?.type || section?.label.slice(0, -1) || 'Entity',
            text: trimmedText,
            author: 'user',
            author_name: getUserName()
          })
        })

        if (!response.ok) {
          throw new Error('Failed to send message')
        }

        // Clear input on success
        if (messageInputRef.current) messageInputRef.current.value = ''

        // Maintain focus on the input
        setTimeout(() => {
          messageInputRef.current?.focus()
        }, 0)

        // Refresh events to show new message
        fetchEvents()
        // Scroll to bottom after sending message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
          // Ensure focus returns to input after scroll
          messageInputRef.current?.focus()
        }, 100)
      } catch (error) {
        console.error('Error sending message:', error)
        alert('Failed to send message. Please try again.')
      } finally {
        setSending(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage().then(() => {
        // Keep focus on input after sending completes
        messageInputRef.current?.focus()
      })
      return
    }

    // Handle PageUp/PageDown for scrolling chat content (like Discord)
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const container = messagesContainerRef.current
      if (!container) return

      // Scroll by approximately one viewport height
      const scrollAmount = container.clientHeight * 0.85

      if (e.key === 'PageUp') {
        container.scrollBy({ top: -scrollAmount, behavior: 'auto' })
      } else {
        container.scrollBy({ top: scrollAmount, behavior: 'auto' })
      }
      return
    }

    // Handle Home/End for jumping to top/bottom of chat (like Discord)
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const container = messagesContainerRef.current
      if (!container) return

      if (e.key === 'Home') {
        // Jump to top
        container.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        // Jump to bottom
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
      }
      return
    }

    // Handle arrow up/down for history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault()

      if (messageHistory.length === 0) return
      if (!messageInputRef.current) return

      // Save current message when starting to navigate history
      if (historyIndex === -1) {
        setTempMessage(messageInputRef.current.value)
      }

      const newIndex = historyIndex === -1
        ? messageHistory.length - 1
        : Math.max(0, historyIndex - 1)

      setHistoryIndex(newIndex)
      messageInputRef.current.value = messageHistory[newIndex]
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()

      if (historyIndex === -1) return
      if (!messageInputRef.current) return

      if (historyIndex === messageHistory.length - 1) {
        // At the end of history, restore temp message
        setHistoryIndex(-1)
        messageInputRef.current.value = tempMessage
      } else {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        messageInputRef.current.value = messageHistory[newIndex]
      }
    }
  }

  // Memoize expensive calculations
  const filteredEvents = useMemo(() => getFilteredEvents(), [events, selectedChannel])
  const eventGroups = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents])
  const channelInfo = useMemo(() => getChannelInfo(), [selectedChannelType, selectedChannel, channels, entitySections])
  const pinnedEntities = useMemo(() => getPinnedEntities(), [pinnedChannels, entitySections])
  const recentEntities = useMemo(() => getRecentEntities(), [events, entitySections])

  // Show login if not authenticated
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app">
      {/* Sidebar */}
      {sidebarVisible && (
        <div className="sidebar">
        <div className="workspace-header">
          <a href={getLoginUrl()} className="workspace-logo-link" title="Go to App Launcher">
            <img src={doibioLogo} alt="comms Logo" className="workspace-logo" />
          </a>
          <h2>comms</h2>
        </div>

        <div className="channels">
          {/* Channels Section (Chat Channels) */}
          <div className="channels-header">
            <span
              onClick={() => toggleSectionCollapsed('channels')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: isSectionCollapsed('channels') ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
              Channels
            </span>
            <button
              className="add-channel-button"
              onClick={() => setShowNewChannelModal(true)}
              title="Create new channel"
            >
              +
            </button>
          </div>

          {!isSectionCollapsed('channels') && channels.filter(channel => !channel.name.startsWith('dm_')).map(channel => (
            <div key={channel.id}>
              <div
                className={`channel ${selectedChannelType === 'channel' && selectedChannel === channel.id ? 'active' : ''}`}
              >
                <span className="channel-icon">#</span>
                <span className="channel-name" onClick={() => switchToChannel(channel.id)}>
                  {channel.name}
                </span>
              </div>
            </div>
          ))}

          {/* AIs Section */}
          <div className="channels-header">
            <span
              onClick={() => toggleSectionCollapsed('ais')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: isSectionCollapsed('ais') ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
              AIs
            </span>
            <button
              className="channel-add-button"
              onClick={handleNewAIChat}
              title="New conversation (Ctrl+K)"
            >
              +
            </button>
          </div>

          {!isSectionCollapsed('ais') && <>
            <div
              className={`channel ${selectedChannelType === 'channel' && selectedChannel === '@Cohere' && !currentAIChatId ? 'active' : ''}`}
            >
              <span className="channel-icon">🤖</span>
              <span
                className="channel-name"
                onClick={() => {
                  setSelectedChannelType('channel')
                  setSelectedChannel('@Cohere')
                  setCurrentAIChatId(null)
                  setChannelMessages([])
                }}
              >
                @Cohere
              </span>
            </div>

            {/* AI Chat Sessions */}
            {aiChats.map(chat => (
              <div key={chat.id}>
                <div
                  className={`channel ${selectedChannelType === 'channel' && selectedChannel === chat.id ? 'active' : ''}`}
                >
                  <span className="channel-icon">💬</span>
                  <span className="channel-name" onClick={() => switchToChannel(chat.id)}>
                    {chat.title}
                  </span>
                </div>
              </div>
            ))}
          </>}

          {/* Contact Requests Section */}
          <div className="channels-header">
            <span
              onClick={() => toggleSectionCollapsed('contact-requests')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: isSectionCollapsed('contact-requests') ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
              Contact Requests
            </span>
            {visitorSessions.filter(s =>
              s.status !== 'disconnected' &&
              (s.name || s.email || s.phone || s.company || s.status === 'chatting' || s.status === 'submitted')
            ).length > 0 && (
              <span className="section-count">
                {visitorSessions.filter(s =>
                  s.status !== 'disconnected' &&
                  (s.name || s.email || s.phone || s.company || s.status === 'chatting' || s.status === 'submitted')
                ).length}
              </span>
            )}
          </div>

          {!isSectionCollapsed('contact-requests') && visitorSessions
            .filter(s =>
              // Show visitors who have entered data OR are actively chatting/submitted
              (s.name || s.email || s.phone || s.company || s.status === 'chatting' || s.status === 'submitted')
            )
            .sort((a, b) => {
              // Sort by online status first, then by activity time
              if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
              return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
            })
            .map(session => {
              const statusIcon = session.status === 'chatting' ? '💬' :
                               session.status === 'submitted' ? '✅' : '👁️'
              const displayName = session.name || `Visitor ${session.id.slice(-4)}`
              const timeAgo = formatTimeAgo(session.lastActivity)
              const onlineIndicator = session.isOnline ? '🟢' : '⚫'

              return (
                <div
                  key={session.id}
                  className={`channel ${selectedChannelType === 'visitor' && selectedVisitorId === session.id ? 'active' : ''}`}
                  onClick={() => handleVisitorClick(session.id)}
                  style={{ opacity: session.isOnline ? 1 : 0.6 }}
                >
                  <span className="channel-icon" title={session.isOnline ? 'Online' : 'Offline'}>
                    {onlineIndicator} {statusIcon}
                  </span>
                  <span className="channel-name">{displayName}</span>
                  {session.unreadCount > 0 && (
                    <span className="unread-badge">{session.unreadCount}</span>
                  )}
                  <span className="session-time" style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.6 }}>
                    {timeAgo}
                  </span>
                </div>
              )
            })}

          {/* Pinned Channels Section */}
          {pinnedEntities.length > 0 && (
            <>
              <div className="channels-header">
                <span>Pinned</span>
              </div>

              {pinnedEntities.map(({ entity, section }) => {
                const eventCount = getEventCountForEntity(entity.id)
                return (
                  <div
                    key={entity.id}
                    className={`channel entity-channel pinned-channel ${selectedChannelType === 'object' && selectedChannel === entity.id ? 'active' : ''}`}
                  >
                    <div
                      className="channel-main"
                      onClick={() => {
                        setSelectedChannelType('object')
                        setSelectedChannel(entity.id)
                      }}
                    >
                      <span className="channel-icon">{section.icon}</span>
                      <span className="channel-name">{entity.name}</span>
                      {eventCount > 0 && (
                        <span className="channel-count">{eventCount}</span>
                      )}
                    </div>
                    <button
                      className="pin-button pinned"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePinChannel(entity.id)
                      }}
                      title="Unpin channel"
                    >
                      📌
                    </button>
                  </div>
                )
              })}
            </>
          )}

          {/* Recent Channels Section */}
          {recentEntities.length > 0 && (
            <>
              <div className="channels-header">
                <span
                  onClick={() => toggleSectionCollapsed('recent')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span style={{
                    display: 'inline-block',
                    transition: 'transform 0.2s',
                    transform: isSectionCollapsed('recent') ? 'rotate(-90deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                  Recent
                </span>
              </div>

              {!isSectionCollapsed('recent') && recentEntities.map(({ entity, section }) => {
                const eventCount = getEventCountForEntity(entity.id)
                const pinned = isPinned(entity.id)

                return (
                  <div
                    key={entity.id}
                    className={`channel entity-channel ${selectedChannelType === 'object' && selectedChannel === entity.id ? 'active' : ''}`}
                  >
                    <div
                      className="channel-main"
                      onClick={() => {
                        setSelectedChannelType('object')
                        setSelectedChannel(entity.id)
                      }}
                    >
                      <span className="channel-icon">{section.icon}</span>
                      <span className="channel-name">{entity.name}</span>
                      {eventCount > 0 && (
                        <span className="channel-count">{eventCount}</span>
                      )}
                    </div>
                    <button
                      className={`pin-button ${pinned ? 'pinned' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePinChannel(entity.id)
                      }}
                      title={pinned ? 'Unpin channel' : 'Pin channel'}
                    >
                      {pinned ? '📌' : '📍'}
                    </button>
                  </div>
                )
              })}
            </>
          )}

          <div className="channels-header">
            <span
              onClick={() => toggleSectionCollapsed('objects')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: isSectionCollapsed('objects') ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
              Objects
            </span>
          </div>

          {!isSectionCollapsed('objects') && <>
            {/* All Channel */}
            <div
              className={`channel ${selectedChannelType === 'object' && selectedChannel === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedChannelType('object')
                setSelectedChannel('all')
              }}
            >
              <span className="channel-icon">#</span>
              <span className="channel-name">all</span>
              {events.length > 0 && (
                <span className="channel-count">{events.length}</span>
              )}
            </div>

            {/* Entity Sections */}
            {entitySections.map(section => (
            <div key={section.type} className="channel-section">
              <div
                className="channel-section-header"
                onClick={() => toggleSection(section.type)}
              >
                <span className="section-arrow">{section.expanded ? '▼' : '▶'}</span>
                <span className="section-icon">{section.icon}</span>
                <span className="section-label">{section.label}</span>
                <span className="section-count">{section.entities.length}</span>
              </div>

              {section.expanded && section.entities.map(entity => {
                const eventCount = getEventCountForEntity(entity.id)
                const pinned = isPinned(entity.id)

                return (
                  <div
                    key={entity.id}
                    className={`channel entity-channel ${selectedChannelType === 'object' && selectedChannel === entity.id ? 'active' : ''}`}
                  >
                    <div
                      className="channel-main"
                      onClick={() => {
                        setSelectedChannelType('object')
                        setSelectedChannel(entity.id)
                      }}
                    >
                      <span className="channel-icon">{section.icon}</span>
                      <span className="channel-name">{entity.name}</span>
                      {eventCount > 0 && (
                        <span className="channel-count">{eventCount}</span>
                      )}
                    </div>
                    <button
                      className={`pin-button ${pinned ? 'pinned' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePinChannel(entity.id)
                      }}
                      title={pinned ? 'Unpin channel' : 'Pin channel'}
                    >
                      {pinned ? '📌' : '📍'}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
          </>}
        </div>

        <UserProfile onSettingsClick={() => setShowSettingsModal(true)} />
      </div>
      )}

      {/* Main content */}
      <div className="main">
        {/* Header */}
        {headerVisible && (
          <div className="channel-header">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
              aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarVisible ? '◀' : '☰'}
            </button>
            <div className="channel-info">
              <h1>
                {selectedChannel === 'all' ? '# ' : ''}
                {channelInfo.name}
              </h1>
              <span className="channel-description">{channelInfo.description}</span>
            </div>
            <button
              className="apps-toggle-btn"
              onClick={() => setAppsVisible(!appsVisible)}
              title={appsVisible ? 'Hide apps' : 'Show apps'}
              aria-label={appsVisible ? 'Hide apps' : 'Show apps'}
            >
              {appsVisible ? '▶' : '☰'}
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="messages" ref={messagesContainerRef}>
          {/* Loading indicator for infinite scroll */}
          {loadingOlderMessages && selectedChannelType === 'channel' && (
            <div style={{ textAlign: 'center', padding: '10px', color: '#888' }}>
              Loading older messages...
            </div>
          )}

          {/* Display markdown file for entities */}
          {selectedChannelType === 'object' && selectedChannel !== 'all' && entityMarkdown && (
            <div style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              border: '1px solid #333333',
              borderRadius: '4px',
              padding: '16px',
              margin: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto'
            }}>
              {entityMarkdown}
            </div>
          )}

          {selectedChannelType === 'visitor' ? (
            // Display visitor conversation
            <>
              {(() => {
                const session = visitorSessions.find(s => s.id === selectedVisitorId)
                if (!session) return <div className="empty"><p>Visitor session not found</p></div>

                return (
                  <>
                    {/* Visitor Info Header */}
                    <div style={{
                      backgroundColor: '#1a1a1a',
                      borderBottom: '1px solid #333',
                      padding: '16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '32px' }}>
                          {session.status === 'chatting' ? '💬' :
                           session.status === 'submitted' ? '✅' : '👁️'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0, fontSize: '18px' }}>
                            {session.name || `Visitor ${session.id.slice(-4)}`}
                          </h3>
                          <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
                            {session.email && <div>📧 {session.email}</div>}
                            {session.phone && <div>📞 {session.phone}</div>}
                            {session.company && <div>🏢 {session.company}</div>}
                            <div>🕐 Connected {formatTimeAgo(session.connectedAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    {channelMessages.length === 0 ? (
                      <div className="empty">
                        <p>No messages yet. Send a message to start the conversation!</p>
                      </div>
                    ) : (
                      channelMessages.map(msg => (
                        <div key={msg.id} className={`message ${msg.author === 'system' ? 'system-message' : msg.author === 'admin' ? 'ai-message' : 'user-message'}`}>
                          <div className="message-header-row">
                            <div className="message-avatar">
                              <span className="avatar-emoji">{msg.author === 'system' ? 'ℹ️' : msg.author === 'admin' ? '👨‍💼' : '👤'}</span>
                            </div>
                            <div className="message-header">
                              <span className="message-author">{msg.author_name}</span>
                              <span className="message-time">{formatTime(msg.timestamp)}</span>
                            </div>
                          </div>
                          <div className="message-text">
                            {renderMessageWithLinks(msg.text)}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )
              })()}
            </>
          ) : selectedChannelType === 'channel' ? (
            // Display channel messages
            <>
              {channelMessages.length === 0 && !isAIStreaming ? (
                <div className="empty">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {channelMessages.map(msg => (
                    <div key={msg.id} className={`message ${msg.author === 'ai' ? 'ai-message' : msg.author === 'system' ? 'system-message' : 'user-message'}`}>
                      <div className="message-header-row">
                        <div className="message-avatar">
                          <span className="avatar-emoji">{msg.author === 'ai' ? '🤖' : msg.author === 'system' ? '⚙️' : '👤'}</span>
                        </div>
                        <div className="message-header">
                          <span className="message-author">{msg.author_name}</span>
                          <span className="message-time">{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                      <div className="message-text">
                          {msg.author === 'ai' ? (
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          ) : msg.author === 'system' ? (
                            <div style={{
                              backgroundColor: '#000000',
                              color: '#00ff00',
                              border: '1px solid #333333',
                              borderRadius: '4px',
                              padding: '12px',
                              fontFamily: 'monospace',
                              fontSize: '13px',
                              whiteSpace: 'pre-wrap',
                              overflowX: 'auto'
                            }}>
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          ) : (
                            renderMessageWithLinks(msg.text)
                          )}
                      </div>
                      {msg.author === 'ai' && msg.tokens && (
                        <div className="token-usage">
                          <span className="token-label">Tokens:</span>
                          <span className="token-detail">{msg.tokens.input} in + {msg.tokens.output} out = {msg.tokens.input + msg.tokens.output} total</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {isAIStreaming && (
                    <div className="message ai-message streaming">
                      <div className="message-header-row">
                        <div className="message-avatar">
                          <span className="avatar-emoji">🤖</span>
                        </div>
                        <div className="message-header">
                          <span className="message-author">AI Assistant</span>
                          <span className="message-time">typing...</span>
                        </div>
                      </div>
                      <div className="message-text">
                        {aiStreamingMessage ? (
                          <ReactMarkdown>{aiStreamingMessage}</ReactMarkdown>
                        ) : (
                          <div className="loading-indicator">
                            <span className="loading-dot">●</span>
                            <span className="loading-dot">●</span>
                            <span className="loading-dot">●</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            // Display object events
            <>
            {loading ? (
              <div className="loading">Loading events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="empty">
                <p>
                  {selectedChannel === 'all'
                    ? 'No events yet. Create your first CRM record to see updates here!'
                    : 'No events for this entity yet.'}
                </p>
              </div>
            ) : (
              Object.entries(eventGroups).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="date-divider">
                  <span>{date}</span>
                </div>

                {dateEvents.map((event) => {
                  const entityDetails = event.entity_id ? getEntityDetails(event.entity_id) : null
                  const isUserMessage = event.data?.message_type === 'user_message'

                  return (
                    <div
                      key={event.event_id}
                      className={`message ${event.status === 'failed' ? 'error' : ''} ${isUserMessage ? 'user-message' : ''}`}
                    >
                      <div className="message-header-row">
                        <div className="message-avatar">
                          <span className="avatar-emoji">
                            {isUserMessage ? (
                              event.data?.author === 'ai' ? '🤖' : '👤'
                            ) : (
                              getEventEmoji(event)
                            )}
                          </span>
                        </div>
                        <div className="message-header">
                          <span className="message-author">
                            {isUserMessage ? (
                              event.data?.author_name || 'User'
                            ) : (
                              <>
                                {event.type === 'create' && 'System Created'}
                                {event.type === 'update' && 'System Updated'}
                                {event.type === 'delete' && 'System Deleted'}
                                {event.type === 'bulk' && 'System Bulk Operation'}
                              </>
                            )}
                          </span>
                          <span className="message-time">{formatTime(event.timestamp)}</span>
                        </div>
                      </div>
                      <div className="message-text">
                          {isUserMessage ? (
                            event.data?.author === 'ai' ? (
                              <ReactMarkdown>{event.data?.text}</ReactMarkdown>
                            ) : (
                              renderMessageWithLinks(event.data?.text || '')
                            )
                          ) : (
                            getEventMessage(event)
                          )}
                      </div>
                      {isUserMessage && event.data?.author === 'ai' && event.data?.tokens && (
                        <div className="token-usage">
                          <span className="token-label">Tokens:</span>
                          <span className="token-detail">{event.data.tokens.input} in + {event.data.tokens.output} out = {event.data.tokens.input + event.data.tokens.output} total</span>
                        </div>
                      )}

                      {!isUserMessage && event.changes?.diff && (
                        <div className="diff-container">
                          <div className="diff-header">Changes:</div>
                          <pre className="diff-content">{event.changes.diff}</pre>
                        </div>
                      )}

                      {!isUserMessage && entityDetails && (
                        <div className="entity-details">
                          {Object.entries(entityDetails)
                            .filter(([key]) => !['id', 'type'].includes(key))
                            .map(([key, value]) => (
                              <div key={key} className="entity-detail-row">
                                <span className="detail-key">{key.replace(/_/g, ' ')}:</span>
                                <span className="detail-value">
                                  {value === null || value === undefined || value === ''
                                    ? '—'
                                    : typeof value === 'boolean'
                                    ? (value ? 'Yes' : 'No')
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}

                      {!isUserMessage && (
                        <div className="message-meta">
                          <span className={`status-badge status-${event.status}`}>
                            {event.status}
                          </span>
                          <span className="event-id">{event.event_id}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
            )}
            {/* Show AI streaming message for object channels */}
            {selectedChannelType === 'object' && isAIStreaming && (
              <div className="message ai-message streaming">
                <div className="message-header-row">
                  <div className="message-avatar">
                    <span className="avatar-emoji">🤖</span>
                  </div>
                  <div className="message-header">
                    <span className="message-author">AI Assistant</span>
                    <span className="message-time">typing...</span>
                  </div>
                </div>
                <div className="message-text">
                  {aiStreamingMessage ? (
                    <ReactMarkdown>{aiStreamingMessage}</ReactMarkdown>
                  ) : (
                    <div className="loading-indicator">
                      <span className="loading-dot">●</span>
                      <span className="loading-dot">●</span>
                      <span className="loading-dot">●</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            </>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input - show for channels, visitors, and non-all object channels */}
        {(selectedChannelType === 'channel' || selectedChannelType === 'visitor' || (selectedChannelType === 'object' && selectedChannel !== 'all')) && (() => {
          // Check if visitor is offline
          const isVisitorOffline = selectedChannelType === 'visitor' &&
            visitorSessions.find(s => s.id === selectedVisitorId)?.isOnline === false

          return (
            <div className="message-input-container">
              {isVisitorOffline && (
                <div style={{
                  padding: '8px 12px',
                  background: '#2a2a2a',
                  borderBottom: '1px solid #444',
                  color: '#888',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  ⚫ Visitor is offline - they won't receive messages
                </div>
              )}
              <textarea
                ref={messageInputRef}
                className="message-input"
                placeholder={
                  isVisitorOffline ? 'Visitor is offline...' :
                  selectedChannelType === 'visitor' ? 'Reply to visitor...' :
                  messageMode === 'chat' ? 'Type a message...' :
                  messageMode === 'ai' ? 'Ask AI anything...' :
                  'Enter unix command...'
                }
                defaultValue={messageText}
                onKeyDown={handleKeyDown}
                disabled={sending || isVisitorOffline}
                rows={1}
              />
            {/* Hide mode selector for visitor conversations - it's always chat mode */}
            {selectedChannelType !== 'visitor' && (
              <select
                className="message-mode-selector"
                value={messageMode}
                onChange={(e) => {
                  setMessageMode(e.target.value as 'chat' | 'ai' | 'unix')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Return focus to message input after Enter key
                    setTimeout(() => messageInputRef.current?.focus(), 0)
                  }
                }}
                onClick={() => {
                  // Return focus to message input after mouse click selection
                  setTimeout(() => messageInputRef.current?.focus(), 0)
                }}
                disabled={sending}
              >
                <option value="chat">💬 Chat</option>
                <option value="ai">🤖 AI</option>
                <option value="unix">⌨️ Unix</option>
              </select>
            )}
              <button
                className="send-button"
                onClick={sendMessage}
                disabled={sending || isVisitorOffline}
              >
                {sending ? 'Sending...' : isVisitorOffline ? 'Offline' : 'Send'}
              </button>
            </div>
          )
        })()}
      </div>

      {/* App Launcher */}
      {appsVisible && <AppLauncher compactMode={compactMode} />}

      {/* New Channel Modal */}
      <NewChannelModal
        isOpen={showNewChannelModal}
        onClose={() => setShowNewChannelModal(false)}
        onCreateChannel={createChannel}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
