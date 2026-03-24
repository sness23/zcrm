import { useState, useEffect, useRef } from 'react'
import './ChatWidget.css'

interface Message {
  id: string
  author: 'visitor' | 'admin' | 'system'
  author_name: string
  text: string
  timestamp: string
}

interface ChatWidgetProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  onSendMessage: (text: string) => void
  isConnected: boolean
}

export function ChatWidget({ isOpen, onClose, messages, onSendMessage, isConnected }: ChatWidgetProps) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !isConnected) return

    onSendMessage(inputText.trim())
    setInputText('')
  }

  if (!isOpen) return null

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-title">💬 Chat with us</span>
          <span className={`chat-status ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? 'Online' : 'Connecting...'}
          </span>
        </div>
        <button className="chat-close" onClick={onClose}>×</button>
      </div>

      <div className="chat-messages">
        {messages.filter(msg => msg.author !== 'system').length === 0 ? (
          <div className="chat-welcome">
            <p>👋 Welcome! How can we help you today?</p>
          </div>
        ) : (
          messages
            .filter(msg => msg.author !== 'system')
            .map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.author}`}>
                <div className="chat-message-author">{msg.author_name}</div>
                <div className="chat-message-text">{msg.text}</div>
                <div className="chat-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="chat-input"
          disabled={!isConnected}
        />
        <button type="submit" className="chat-send" disabled={!isConnected || !inputText.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
