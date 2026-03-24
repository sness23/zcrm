import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import UserMenu from './components/UserMenu'
import './App.css'
import doibioLogo from './assets/doibio.png'

interface Lead {
  id: string
  name: string
  first_name?: string
  last_name?: string
  email?: string
  status?: string
  source?: string
  title?: string
  company?: string
  description?: string
  type: string
  profile_image?: string
  avatar_url?: string
}

function AppContent() {
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
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [user])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:9600/api/entities/leads')

      if (!response.ok) {
        throw new Error('Failed to fetch leads')
      }

      const data = await response.json()
      setLeads(data.entities || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError('Failed to load leads. Make sure the API server is running on port 9600.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'new': return '#60a5fa' // blue
      case 'qualified': return '#34d399' // green
      case 'contacted': return '#fbbf24' // yellow
      case 'nurturing': return '#a78bfa' // purple
      case 'converted': return '#10b981' // emerald
      case 'lost': return '#ef4444' // red
      default: return '#9ca3af' // gray
    }
  }

  const getSourceBadge = (source?: string) => {
    const badges: { [key: string]: string } = {
      'referral': '🤝',
      'website': '🌐',
      'social': '📱',
      'email': '📧',
      'event': '🎪',
      'cold': '❄️',
      'partner': '🔗'
    }
    return badges[source?.toLowerCase() || ''] || '📋'
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const getAvatarColor = (name: string) => {
    // Generate a consistent color based on name
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // indigo-purple
      'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // pink-rose
      'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)', // teal-cyan
      'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', // amber-red
      'linear-gradient(135deg, #10b981 0%, #22c55e 100%)', // emerald-green
      'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', // blue-indigo
      'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // purple-fuchsia
      'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)', // orange-amber
    ]
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[index % colors.length]
  }

  // Show login screen if not authenticated
  if (authLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="doi.bio Logo" className="app-logo" />
            </a>
            <div className="header-text">
              <h1>leads</h1>
              <div className="header-subtitle">Lead management system</div>
            </div>
          </div>
          <div className="header-right">
            <button className="refresh-btn" onClick={fetchLeads} disabled={loading}>
              {loading ? '⟳ Loading...' : '🔄 Refresh'}
            </button>
            <div className="lead-count">
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={fetchLeads}>Retry</button>
          </div>
        )}

        {loading && leads.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h2>No leads yet</h2>
            <p>Create your first lead in the vault at <code>vault/leads/</code></p>
          </div>
        ) : (
          <div className="leads-grid">
            {leads.map(lead => (
              <div key={lead.id} className="lead-card">
                <div className="lead-header">
                  <div className="lead-avatar-wrapper">
                    {(lead.profile_image || lead.avatar_url) ? (
                      <img
                        src={lead.profile_image || lead.avatar_url}
                        alt={lead.name}
                        className="lead-avatar"
                        onError={(e) => {
                          // Hide image on error, show initials instead
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div
                      className="lead-avatar-initials"
                      style={{
                        background: getAvatarColor(lead.name),
                        display: (lead.profile_image || lead.avatar_url) ? 'none' : 'flex'
                      }}
                    >
                      {getInitials(lead.name)}
                    </div>
                  </div>
                  <div className="lead-name">
                    <h3>{lead.name}</h3>
                    {lead.title && <p className="lead-title">{lead.title}</p>}
                  </div>
                  <div
                    className="lead-status"
                    style={{ backgroundColor: getStatusColor(lead.status) }}
                  >
                    {lead.status || 'New'}
                  </div>
                </div>

                {lead.company && (
                  <div className="lead-company">
                    🏢 {lead.company}
                  </div>
                )}

                {lead.email && (
                  <div className="lead-email">
                    📧 <a href={`mailto:${lead.email}`}>{lead.email}</a>
                  </div>
                )}

                {lead.description && (
                  <div className="lead-description">
                    {lead.description}
                  </div>
                )}

                <div className="lead-footer">
                  {lead.source && (
                    <div className="lead-source">
                      {getSourceBadge(lead.source)} {lead.source}
                    </div>
                  )}
                  <div className="lead-id">
                    ID: {lead.id.slice(-8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
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
