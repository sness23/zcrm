import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import './ChatPanel.css'

interface ChannelMessage {
  id: string
  channel_id: string
  author: string
  author_name: string
  text: string
  timestamp: string
  streaming?: boolean
  tokens?: {
    input: number
    output: number
  }
}

interface ChatPanelProps {
  headerVisible?: boolean
}

export default function ChatPanel({ headerVisible = true }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [sending, setSending] = useState(false)
  const [messageMode, setMessageMode] = useState<'chat' | 'ai' | 'unix'>('chat')
  const [connected, setConnected] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const userHasScrolledRef = useRef(false)

  // Auto-scroll to bottom on new messages or message updates (streaming)
  useEffect(() => {
    if (!userHasScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages])

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      userHasScrolledRef.current = !isNearBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch initial messages for #general
  useEffect(() => {
    fetchMessages()
  }, [])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return
      }
    }

    const ws = new WebSocket('ws://localhost:9600')

    ws.onopen = () => {
      console.log('[ChatPanel] WebSocket connected')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'channel_message' && data.channel_id === 'ch_general') {
        setMessages(prev => {
          // Check for duplicates
          if (prev.some(m => m.id === data.message.id)) {
            return prev
          }
          return [...prev, data.message]
        })
      } else if (data.type === 'ai_start' && data.channel_id === 'ch_general') {
        // AI started responding - add empty message
        setMessages(prev => [...prev, data.message])
        userHasScrolledRef.current = false // Enable auto-scroll
      } else if (data.type === 'ai_chunk' && data.channel_id === 'ch_general') {
        // AI chunk received - update message text
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, text: data.full_text }
            : msg
        ))
        userHasScrolledRef.current = false // Keep scrolling with streaming text
      } else if (data.type === 'ai_complete' && data.channel_id === 'ch_general') {
        // AI response complete - update tokens
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, streaming: false, tokens: data.tokens }
            : msg
        ))
        userHasScrolledRef.current = false // Final scroll to show tokens
      } else if (data.type === 'ai_error' && data.channel_id === 'ch_general') {
        // AI error - remove the empty message
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id))
      }
    }

    ws.onclose = () => {
      console.log('[ChatPanel] WebSocket disconnected')
      setConnected(false)
    }

    ws.onerror = (error) => {
      console.error('[ChatPanel] WebSocket error:', error)
      setConnected(false)
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [])

  const fetchMessages = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/channels/ch_general/messages?limit=50')
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      setMessages(data.messages || [])

      // Scroll to bottom after loading
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }, 100)
    } catch (error) {
      console.error('[ChatPanel] Error fetching messages:', error)
    }
  }

  const sendMessage = async () => {
    const currentText = messageInputRef.current?.value || ''
    if (!currentText.trim() || sending) return

    const trimmedText = currentText.trim()
    userHasScrolledRef.current = false

    setSending(true)

    try {
      const response = await fetch('http://localhost:9600/api/channels/ch_general/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmedText,
          author: 'user',
          author_name: 'Analytics User'
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      // Clear input
      if (messageInputRef.current) {
        messageInputRef.current.value = ''
      }

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        messageInputRef.current?.focus()
      }, 100)
    } catch (error) {
      console.error('[ChatPanel] Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const groupMessagesByDate = () => {
    const groups: { [key: string]: ChannelMessage[] } = {}
    const dateOrder: string[] = []

    messages.forEach(msg => {
      const date = new Date(msg.timestamp)
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      if (!groups[dateKey]) {
        groups[dateKey] = []
        dateOrder.push(dateKey)
      }
      groups[dateKey].push(msg)
    })

    return { groups, dateOrder }
  }

  const { groups, dateOrder } = groupMessagesByDate()

  return (
    <div className="chat-panel">
      {headerVisible && (
        <div className="chat-header">
          <h2># general</h2>
          <div className="connection-status">
            <span className={connected ? 'connected' : 'disconnected'}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
        </div>
      )}

      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="empty">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {dateOrder.map(date => (
              <div key={date}>
                <div className="date-divider">
                  <span>{date}</span>
                </div>
                {groups[date].map(msg => (
                  <div
                    key={msg.id}
                    className={`message ${msg.author === 'ai' ? 'ai-message' : ''} ${msg.author === 'system' ? 'system-message' : ''}`}
                  >
                    <div className="message-header-row">
                      <div className="message-avatar">
                        <span className="avatar-emoji">
                          {msg.author === 'ai' ? '🤖' : msg.author === 'system' ? '⚙️' : '👤'}
                        </span>
                      </div>
                      <div className="message-header">
                        <span className="message-author">{msg.author_name}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                    <div className="message-text">
                      {msg.author === 'ai' ? (
                        msg.streaming && !msg.text ? (
                          <span className="streaming-indicator">Thinking...</span>
                        ) : (
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        )
                      ) : msg.author === 'system' ? (
                        <div className="terminal-output">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                    {msg.author === 'ai' && msg.streaming && msg.text && (
                      <div className="streaming-indicator">●●● streaming...</div>
                    )}
                    {msg.author === 'ai' && msg.tokens && (
                      <div className="token-usage">
                        <span className="token-label">Tokens:</span>
                        <span className="token-detail">
                          {msg.tokens.input} in + {msg.tokens.output} out = {msg.tokens.input + msg.tokens.output} total
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          ref={messageInputRef}
          className="chat-input"
          placeholder={
            messageMode === 'chat' ? 'Type a message...' :
            messageMode === 'ai' ? 'Ask AI anything...' :
            'Enter unix command...'
          }
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
        />
        <select
          className="mode-selector"
          value={messageMode}
          onChange={(e) => setMessageMode(e.target.value as 'chat' | 'ai' | 'unix')}
          disabled={sending}
        >
          <option value="chat">💬 Chat</option>
          <option value="ai">🤖 AI</option>
          <option value="unix">⌨️ Unix</option>
        </select>
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
