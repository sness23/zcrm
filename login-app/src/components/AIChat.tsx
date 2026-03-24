import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useAuth } from '../contexts/LocalAuthContext'
import { useAIChat } from '../hooks/useAIChat'
import ReactMarkdown from 'react-markdown'
import './AIChat.css'

interface Message {
  id: string
  text: string
  author: 'user' | 'ai'
  author_name: string
  timestamp: string
  tokens?: {
    input: number
    output: number
  }
}

// Memoized message component to prevent re-renders
const MessageItem = memo(({ message }: { message: Message }) => (
  <div className={`ai-message ${message.author}`}>
    <div className="ai-message-avatar">
      {message.author === 'user' ? '👤' : '🤖'}
    </div>
    <div className="ai-message-content">
      <div className="ai-message-header">
        <span className="ai-message-author">{message.author_name}</span>
        <span className="ai-message-time">
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
      {message.author === 'ai' ? (
        <div className="ai-message-markdown">
          <ReactMarkdown
            components={{
              li: ({ node, ...props }) => <li key={`${message.id}-${node?.position?.start.line}`} {...props} />,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="ai-message-text">{message.text}</div>
      )}
      {message.tokens && (
        <div className="ai-message-tokens">
          {message.tokens.input + message.tokens.output} tokens
        </div>
      )}
    </div>
  </div>
))

MessageItem.displayName = 'MessageItem'

interface AIChatProps {
  nextFocusRef?: React.RefObject<HTMLButtonElement | null>
  chatId?: string
  onChatCreated?: (chatId: string, firstMessage: string) => void
}

export default function AIChat({ nextFocusRef, chatId = 'dm_cohere', onChatCreated }: AIChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [isAIStreaming, setIsAIStreaming] = useState(false)
  const [aiStreamingMessage, setAiStreamingMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const aiStreamingMessageRef = useRef('')
  const isUserScrolledUpRef = useRef(false)

  const { sendAIMessage } = useAIChat({ channelType: 'channel' })

  // Auto-scroll to bottom - but only scroll when not user-scrolled-up
  useEffect(() => {
    if (!isUserScrolledUpRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      // Use instant scroll instead of smooth to avoid stuttering
      container.scrollTop = container.scrollHeight
    }
  }, [messages, aiStreamingMessage])

  // Detect user scroll
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      isUserScrolledUpRef.current = !isAtBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Maintain focus on input during AI streaming
  useEffect(() => {
    if (isAIStreaming && messageInputRef.current) {
      const focusInterval = setInterval(() => {
        if (document.activeElement !== messageInputRef.current) {
          messageInputRef.current?.focus()
        }
      }, 100)

      return () => clearInterval(focusInterval)
    }
  }, [isAIStreaming])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => messageInputRef.current?.focus(), 0)
  }, [])

  // Focus input on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        messageInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadMessages = useCallback(async () => {
    console.log(`[AIChat] Loading messages for chatId: ${chatId}`)

    try {
      const response = await fetch(`http://localhost:9600/api/channels/${chatId}/messages`)
      if (!response.ok) {
        // If chat doesn't exist on backend, try loading from vault first, then localStorage
        await loadFromVaultOrLocalStorage()
        return
      }
      const data = await response.json()

      const formattedMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        author: msg.author === 'user' ? 'user' : 'ai',
        author_name: msg.author_name || (msg.author === 'user' ? 'You' : 'Cohere'),
        timestamp: msg.timestamp,
        tokens: msg.tokens
      }))

      console.log(`[AIChat] Loaded ${formattedMessages.length} messages from backend`)

      // If backend has no messages and this is not the default chat, try vault/localStorage
      if (formattedMessages.length === 0 && chatId !== 'dm_cohere') {
        await loadFromVaultOrLocalStorage()
        return
      }

      setMessages(formattedMessages)
    } catch (error) {
      console.error('Error loading messages:', error)
      await loadFromVaultOrLocalStorage()
    }
  }, [chatId])

  const loadFromVaultOrLocalStorage = async () => {
    // Load from vault only
    try {
      const vaultResponse = await fetch(`http://localhost:9600/api/vault/chats/${chatId}`)
      if (vaultResponse.ok) {
        const vaultData = await vaultResponse.json()
        if (vaultData.messages && vaultData.messages.length > 0) {
          console.log(`[AIChat] Loaded ${vaultData.messages.length} messages from vault`)
          setMessages(vaultData.messages)
          return
        }
      }
    } catch (err) {
      console.log('[AIChat] Vault load failed')
    }

    // No messages found
    console.log(`[AIChat] No messages found in vault, starting empty`)
    setMessages([])
  }

  // Load messages from API when chatId changes
  useEffect(() => {
    // Clear messages first to show loading state
    setMessages([])
    loadMessages()
  }, [loadMessages])

  // Save messages to vault for non-backend chats (only when messages change, not chatId)
  useEffect(() => {
    // Don't save if messages is empty (happens during chat switching)
    if (messages.length > 0 && chatId !== 'dm_cohere') {
      console.log(`[AIChat] Saving ${messages.length} messages to vault for chatId: ${chatId}`)
      saveMessagesToVault(chatId, messages)
    }
  }, [messages]) // Only depend on messages, not chatId

  const saveMessagesToVault = async (chatId: string, messages: Message[]) => {
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
        console.log(`[AIChat] Saved to vault: vault/chats/${chatId}.md`)
      }
    } catch (error) {
      console.log('[AIChat] Could not save to vault, using localStorage only')
    }
  }

  const handleSendMessage = async () => {
    const trimmedText = messageText.trim()
    if (!trimmedText || sending || isAIStreaming) return

    setSending(true)
    setIsAIStreaming(true)
    setAiStreamingMessage('')
    aiStreamingMessageRef.current = ''

    try {
      // Save user message (or create locally if backend doesn't support this chat)
      let userId = `msg_${Date.now()}`
      try {
        const userMsgResponse = await fetch(`http://localhost:9600/api/channels/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmedText,
            author: 'user',
            author_name: user?.name || user?.email || 'User'
          })
        }).catch(() => null) // Suppress network errors for new chats

        if (userMsgResponse?.ok) {
          const userMsg = await userMsgResponse.json()
          userId = userMsg.id
        }
      } catch (err) {
        // Expected for new chats - will save to vault instead
      }

      const newUserMessage: Message = {
        id: userId,
        text: trimmedText,
        author: 'user',
        author_name: user?.name || user?.email || 'User',
        timestamp: new Date().toISOString()
      }

      // If this is the first message, notify parent to add chat to list
      const isFirstMessage = messages.length === 0

      setMessages(prev => [...prev, newUserMessage])
      setMessageText('')
      setSending(false)

      // Notify parent that chat has been created with first message
      if (isFirstMessage && onChatCreated) {
        onChatCreated(chatId, trimmedText)
      }

      // Keep focus on input
      setTimeout(() => messageInputRef.current?.focus(), 0)

      // Get AI response
      const history = [...messages, newUserMessage].slice(-10).map(m => ({
        id: m.id,
        text: m.text,
        author_name: m.author_name,
        timestamp: m.timestamp,
        type: m.author as 'user' | 'ai'
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

          // Save AI message (or create locally if backend doesn't support this chat)
          let aiMsgId = `msg_${Date.now()}`
          try {
            const aiMsgResponse = await fetch(`http://localhost:9600/api/channels/${chatId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: completeMessage,
                author: 'ai',
                author_name: 'Cohere',
                tokens: tokens ? { input: tokens.input, output: tokens.output } : undefined
              })
            }).catch(() => null) // Suppress network errors for new chats

            if (aiMsgResponse?.ok) {
              const aiMsg = await aiMsgResponse.json()
              aiMsgId = aiMsg.id
            }
          } catch (error) {
            // Expected for new chats - will save to vault instead
          }

          const newAiMessage: Message = {
            id: aiMsgId,
            text: completeMessage,
            author: 'ai',
            author_name: 'Cohere',
            timestamp: new Date().toISOString(),
            tokens: tokens
          }
          setMessages(prev => [...prev, newAiMessage])

          setIsAIStreaming(false)
          setAiStreamingMessage('')
          aiStreamingMessageRef.current = ''

          // Keep focus on input after AI response
          setTimeout(() => messageInputRef.current?.focus(), 0)
        }
      )
    } catch (error) {
      console.error('Error:', error)
      setSending(false)
      setIsAIStreaming(false)
      setAiStreamingMessage('')
      aiStreamingMessageRef.current = ''

      // Keep focus on input even on error
      setTimeout(() => messageInputRef.current?.focus(), 0)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === 'Tab' && nextFocusRef?.current) {
      e.preventDefault()
      nextFocusRef.current.focus()
    }
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat-messages" ref={messagesContainerRef}>
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {isAIStreaming && aiStreamingMessage && (
          <div className="ai-message ai">
            <div className="ai-message-avatar">🤖</div>
            <div className="ai-message-content">
              <div className="ai-message-header">
                <span className="ai-message-author">Cohere</span>
                <span className="ai-message-streaming">Typing...</span>
              </div>
              <div className="ai-message-markdown">
                <ReactMarkdown
                  components={{
                    li: ({ node, ...props }) => <li key={node?.position?.start.line} {...props} />,
                  }}
                >
                  {aiStreamingMessage}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-input-container">
        <textarea
          ref={messageInputRef}
          className="ai-chat-input"
          placeholder="Ask me anything..."
          value={messageText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
        />
        <button
          className="ai-chat-send-button"
          onClick={handleSendMessage}
          disabled={!messageText.trim() || sending || isAIStreaming}
        >
          {sending || isAIStreaming ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  )
}
