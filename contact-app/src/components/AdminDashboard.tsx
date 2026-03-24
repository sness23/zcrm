import { useState, useEffect } from 'react'
import './AdminDashboard.css'

interface VisitorSession {
  id: string
  socket_id: string
  phone?: string
  email?: string
  name?: string
  company?: string
  connected_at: string
  last_activity: string
  page_url: string
  status: string
  imessage_sent?: number
  imessage_sent_at?: string
}

export function AdminDashboard() {
  const [visitors, setVisitors] = useState<VisitorSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActiveVisitors = async () => {
    try {
      const response = await fetch('http://localhost:9600/api/visitors/active')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setVisitors(data.visitors || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching visitors:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch visitors')
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchActiveVisitors()

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchActiveVisitors, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h2>👥 Active Visitors</h2>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h2>👥 Active Visitors</h2>
        </div>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchActiveVisitors}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>👥 Active Visitors</h2>
        <div className="visitor-count">
          <span className="count">{visitors.length}</span>
          <span className="label">{visitors.length === 1 ? 'visitor' : 'visitors'}</span>
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="empty-state">
          <p>No active visitors at the moment</p>
          <p className="hint">Waiting for someone to connect...</p>
        </div>
      ) : (
        <div className="visitors-list">
          {visitors.map((visitor) => (
            <div key={visitor.id} className="visitor-card">
              <div className="visitor-header">
                <div className="visitor-status">
                  <span className="status-indicator active"></span>
                  <span className="status-text">Active</span>
                </div>
                <div className="visitor-time">
                  Connected {formatTimestamp(visitor.connected_at)}
                </div>
              </div>

              <div className="visitor-details">
                {visitor.name && (
                  <div className="detail-row">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{visitor.name}</span>
                  </div>
                )}

                {visitor.phone && (
                  <div className="detail-row">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">
                      {visitor.phone}
                      {visitor.imessage_sent === 1 && (
                        <span className="imessage-badge">📱 iMessage sent</span>
                      )}
                    </span>
                  </div>
                )}

                {visitor.email && (
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{visitor.email}</span>
                  </div>
                )}

                {visitor.company && (
                  <div className="detail-row">
                    <span className="detail-label">Company:</span>
                    <span className="detail-value">{visitor.company}</span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">Page:</span>
                  <span className="detail-value page-url">{visitor.page_url || 'Unknown'}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Session ID:</span>
                  <span className="detail-value session-id">{visitor.id}</span>
                </div>
              </div>

              <div className="visitor-footer">
                <span className="last-activity">
                  Last activity: {formatTimestamp(visitor.last_activity)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
