import { useState, useEffect } from 'react'
import { Search, Plus, MessageSquare } from 'lucide-react'
import './Sidebar.css'

interface Chat {
  id: string
  title: string
  timestamp: string
  isPinned: boolean
}

interface SidebarProps {
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
  currentChatId?: string
  chats: Chat[]
}

export default function Sidebar({ onNewChat, onSelectChat, currentChatId, chats }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredChats, setFilteredChats] = useState<Chat[]>([])

  // Filter chats based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = chats.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredChats(filtered)
    } else {
      setFilteredChats(chats)
    }
  }, [searchQuery, chats])

  const pinnedChats = filteredChats.filter(chat => chat.isPinned)
  const regularChats = filteredChats.filter(chat => !chat.isPinned)

  return (
    <div className="sidebar">
      {/* New Chat Button */}
      <button className="sidebar-new-chat" onClick={onNewChat}>
        <Plus className="w-5 h-5" />
        <span>New chat</span>
      </button>

      {/* Search */}
      <div className="sidebar-search">
        <Search className="w-4 h-4 sidebar-search-icon" />
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Chat List */}
      <div className="sidebar-chats">
        {/* Pinned Chats */}
        {pinnedChats.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Pinned</div>
            {pinnedChats.map(chat => (
              <button
                key={chat.id}
                className={`sidebar-chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="sidebar-chat-title">{chat.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Regular Chats */}
        {regularChats.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Recent</div>
            {regularChats.map(chat => (
              <button
                key={chat.id}
                className={`sidebar-chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="sidebar-chat-title">{chat.title}</span>
              </button>
            ))}
          </div>
        )}

        {filteredChats.length === 0 && (
          <div className="sidebar-empty">
            {searchQuery ? 'No chats found' : 'No chats yet'}
          </div>
        )}
      </div>
    </div>
  )
}
