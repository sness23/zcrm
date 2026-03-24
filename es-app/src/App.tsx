import { useState, useEffect, useRef } from 'react'
import doibioLogo from './assets/doibio.png'
import './App.css'

interface SearchResult {
  path: string
  type: string
  snippet: string
  lineNumber: number
  matchCount: number
  score?: number
}

const API_BASE_URL = 'http://localhost:9600/api'

function App() {
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

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/search/es?q=${encodeURIComponent(query.trim())}`
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'account':
        return '🏢'
      case 'contact':
        return '👤'
      case 'opportunity':
        return '💰'
      case 'lead':
        return '🎯'
      case 'activity':
        return '📅'
      case 'task':
        return '✓'
      case 'quote':
        return '📄'
      case 'product':
        return '📦'
      case 'campaign':
        return '📢'
      default:
        return '📝'
    }
  }

  const openFile = (path: string) => {
    // For now, just log the path - could open in editor or show detail view
    console.log('Opening file:', path)
    alert(`File: ${path}\n\nIn a full implementation, this would open the file in your editor or show a detail view.`)
  }

  return (
    <div className="app">
      <div className="header">
        <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
          <img src={doibioLogo} alt="doi.bio Logo" className="header-logo" />
        </a>
        <div className="header-text">
          <h1>⚡ CRM Vault Search (Elasticsearch)</h1>
          <p>Fast search powered by Elasticsearch</p>
        </div>
      </div>

      <div className="search-container">
        <div className="search-box-wrapper">
          <div className="search-input-container">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search for accounts, contacts, opportunities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="search-button"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="results-container">
          {loading && <div className="loading">Searching Elasticsearch...</div>}

          {error && <div className="error">Error: {error}</div>}

          {!loading && !error && !hasSearched && (
            <div className="empty">
              Type a search query and press Enter to search with Elasticsearch
            </div>
          )}

          {!loading && !error && hasSearched && results.length === 0 && (
            <div className="empty">
              No results found for "{query}"
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <>
              <div className="results-header">
                <p className="results-count">
                  Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
                </p>
              </div>

              <div className="results-list">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="result-item"
                    onClick={() => openFile(result.path)}
                  >
                    <div className="result-header">
                      <span className="result-icon">{getFileIcon(result.type)}</span>
                      <span className="result-path">{result.path}</span>
                      <span className="result-type">{result.type}</span>
                      {result.score && (
                        <span className="result-score">Score: {result.score.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="result-snippet" dangerouslySetInnerHTML={{ __html: result.snippet }}>
                    </div>

                    <div className="result-meta">
                      <div className="meta-item">
                        <span className="meta-label">Matches:</span>
                        <span>{result.matchCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
