import { useState, useEffect } from 'react'
import { RefreshCw, ExternalLink, Star, Check, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import './App.css'
import logo from './assets/doibio.png'

interface Feed {
  id: string
  title: string
  url: string
  category: string
  unreadCount: number
}

interface Article {
  id: string
  feedId: string
  title: string
  link: string
  pubDate: string
  author?: string
  content: string
  excerpt: string
  read: boolean
}

const API_URL = '/api'

// Standard journal abbreviations
const JOURNAL_ABBREVIATIONS: Record<string, string> = {
  'Nature Structural & Molecular Biology': 'Nat Struct Mol Biol',
  'Science Magazine - Biochemistry': 'Science',
  'Acta Crystallographica D': 'Acta Cryst D',
  'PLoS Biology': 'PLoS Biol',
  'eLife - Structural Biology': 'eLife',
  'Nature': 'Nature',
  'Cell': 'Cell',
  'Protein Science': 'Protein Sci',
  'Journal of Molecular Biology': 'JMB',
  'Structure': 'Structure'
}

function getJournalAbbreviation(title: string): string {
  return JOURNAL_ABBREVIATIONS[title] || title
}

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [focusPane, setFocusPane] = useState<'feeds' | 'articles' | 'reader'>('feeds')
  const [sidebarVisible, setSidebarVisible] = useState(true)

  useEffect(() => {
    loadFeeds()
  }, [])

  useEffect(() => {
    if (selectedFeed) {
      loadArticles(selectedFeed)
    }
  }, [selectedFeed])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+S to toggle sidebar
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setSidebarVisible(prev => !prev)
        return
      }

      // Left/Right arrow keys for pane navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (focusPane === 'feeds' && articles.length > 0) {
          setFocusPane('articles')
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (focusPane === 'articles') {
          setFocusPane('feeds')
        } else if (focusPane === 'feeds' && articles.length > 0) {
          setFocusPane('articles')
        }
      }
      // Up/Down arrow keys for navigation within current pane
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()

        if (focusPane === 'feeds') {
          const currentIndex = feeds.findIndex(f => f.id === selectedFeed)
          if (currentIndex === -1) return

          if (e.key === 'ArrowDown') {
            const nextIndex = (currentIndex + 1) % feeds.length
            setSelectedFeed(feeds[nextIndex].id)
          } else {
            const prevIndex = currentIndex === 0 ? feeds.length - 1 : currentIndex - 1
            setSelectedFeed(feeds[prevIndex].id)
          }
        } else if (focusPane === 'articles') {
          const currentIndex = articles.findIndex(a => a.id === selectedArticle?.id)
          if (currentIndex === -1 && articles.length > 0) {
            setSelectedArticle(articles[0])
            // Scroll first article into view
            setTimeout(() => {
              const firstArticle = document.querySelector('.article-item')
              if (firstArticle) {
                firstArticle.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }, 0)
            return
          }

          if (e.key === 'ArrowDown') {
            const nextIndex = (currentIndex + 1) % articles.length
            const article = articles[nextIndex]
            setSelectedArticle(article)
            if (!article.read) {
              markArticleAsRead(article.id)
            }
            // Scroll article into view
            setTimeout(() => {
              const articleElement = document.querySelector(`.article-item:nth-child(${nextIndex + 1})`)
              if (articleElement) {
                articleElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }, 0)
          } else {
            const prevIndex = currentIndex === 0 ? articles.length - 1 : currentIndex - 1
            const article = articles[prevIndex]
            setSelectedArticle(article)
            if (!article.read) {
              markArticleAsRead(article.id)
            }
            // Scroll article into view
            setTimeout(() => {
              const articleElement = document.querySelector(`.article-item:nth-child(${prevIndex + 1})`)
              if (articleElement) {
                articleElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }, 0)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [feeds, selectedFeed, articles, selectedArticle, focusPane])

  const loadFeeds = async () => {
    try {
      const response = await fetch(`${API_URL}/feeds`)
      const data = await response.json()
      setFeeds(data)
      if (data.length > 0 && !selectedFeed) {
        setSelectedFeed(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load feeds:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadArticles = async (feedId: string) => {
    try {
      const response = await fetch(`${API_URL}/feeds/${feedId}/articles`)
      const data = await response.json()
      setArticles(data)
      if (data.length > 0) {
        // Select first unread article, or first article if all are read
        const firstUnread = data.find((article: Article) => !article.read)
        setSelectedArticle(firstUnread || data[0])
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    }
  }

  const refreshFeeds = async () => {
    setRefreshing(true)
    try {
      await fetch(`${API_URL}/feeds/refresh`, { method: 'POST' })
      await loadFeeds()
      if (selectedFeed) {
        await loadArticles(selectedFeed)
      }
    } catch (error) {
      console.error('Failed to refresh feeds:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const markArticleAsRead = async (articleId: string) => {
    try {
      await fetch(`${API_URL}/articles/${articleId}/read`, { method: 'POST' })
      setArticles(articles.map(a =>
        a.id === articleId ? { ...a, read: true } : a
      ))
    } catch (error) {
      console.error('Failed to mark article as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!selectedFeed) return
    try {
      await fetch(`${API_URL}/feeds/${selectedFeed}/mark-all-read`, { method: 'POST' })
      setArticles(articles.map(a => ({ ...a, read: true })))
      setFeeds(feeds.map(f =>
        f.id === selectedFeed ? { ...f, unreadCount: 0 } : f
      ))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const publishToBlog = async (article: Article) => {
    try {
      const selectedFeedData = feeds.find(f => f.id === selectedFeed)
      await fetch(`${API_URL}/blog/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          title: article.title,
          content: article.content,
          pubDate: article.pubDate,
          author: article.author,
          sourceUrl: article.link,
          sourceFeed: selectedFeedData?.title
        })
      })
      alert('Article published to blog!')
    } catch (error) {
      console.error('Failed to publish to blog:', error)
      alert('Failed to publish article to blog')
    }
  }

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article)
    if (!article.read) {
      markArticleAsRead(article.id)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

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

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading feeds...</div>
      </div>
    )
  }

  const selectedFeedData = feeds.find(f => f.id === selectedFeed)

  return (
    <div className="app">
      <div className={`sidebar ${!sidebarVisible ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="doi.bio" className="sidebar-logo" />
          <h1>news</h1>
          <button
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={refreshFeeds}
            disabled={refreshing}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className={`feed-list ${focusPane === 'feeds' ? 'focused' : ''}`}>
          {feeds.map(feed => (
            <div
              key={feed.id}
              className={`feed-item ${selectedFeed === feed.id ? 'active' : ''}`}
              onClick={() => setSelectedFeed(feed.id)}
            >
              <div className="feed-item-icon">
                {feed.category === 'journal' ? '📖' :
                 feed.category === 'news' ? '📰' :
                 feed.category === 'preprint' ? '📄' : '🔬'}
              </div>
              <div className="feed-item-content">
                <div className="feed-item-title">{getJournalAbbreviation(feed.title)}</div>
                <div className={`feed-item-count ${feed.unreadCount > 0 ? 'unread' : ''}`}>
                  {feed.unreadCount > 0 ? `${feed.unreadCount}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="content-header">
          <h2>{selectedFeedData?.title || 'Select a feed'}</h2>
          {articles.length > 0 && (
            <button className="mark-all-btn" onClick={markAllAsRead}>
              <Check size={16} />
              Mark all as read
            </button>
          )}
        </div>

        <div className={`article-list ${focusPane === 'articles' ? 'focused' : ''}`}>
          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>No articles</h3>
              <p>This feed doesn't have any articles yet.</p>
            </div>
          ) : (
            articles.map(article => (
              <div
                key={article.id}
                className={`article-item ${selectedArticle?.id === article.id ? 'selected' : ''} ${article.read ? 'read' : ''}`}
                onClick={() => handleArticleClick(article)}
              >
                <div className="article-header">
                  <div className="article-title">{article.title}</div>
                  <div className="article-meta">
                    <span>{formatDate(article.pubDate)}</span>
                    {article.author && <span>• {article.author}</span>}
                  </div>
                </div>
                <div className="article-content">
                  <ReactMarkdown>{article.content}</ReactMarkdown>
                </div>
                <div className="article-actions">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                    Open
                  </a>
                  <button className="action-btn" onClick={(e) => e.stopPropagation()}>
                    <Star size={16} />
                    Save
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      publishToBlog(article)
                    }}
                  >
                    <FileText size={16} />
                    Blog
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
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
