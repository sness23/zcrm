import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'
import logo from './assets/doibio.png'

interface BlogPost {
  id: string
  title: string
  content: string
  pubDate: string
  author?: string
  sourceUrl?: string
  sourceFeed?: string
}

const API_URL = '/api'

function App() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      const response = await fetch(`${API_URL}/blog`)
      const data = await response.json()
      setPosts(data)
    } catch (error) {
      console.error('Failed to load blog posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading blog posts...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <img src={logo} alt="doi.bio" className="logo" />
        <h1>blog</h1>
      </div>

      <div className="article-list">
        {posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3>No blog posts yet</h3>
            <p>Publish articles from the news feed to get started.</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="article-item">
              <div className="article-header">
                <div className="article-title">{post.title}</div>
                <div className="article-meta">
                  <span>{formatDate(post.pubDate)}</span>
                  {post.author && <span>• {post.author}</span>}
                  {post.sourceFeed && <span>• {post.sourceFeed}</span>}
                </div>
              </div>
              <div className="article-content">
                <ReactMarkdown>{post.content}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App
