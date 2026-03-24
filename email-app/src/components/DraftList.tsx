import { useState, useEffect } from 'react'
import { getDrafts, type EmailDraft } from '../lib/api'
import './DraftList.css'

interface DraftListProps {
  onRefresh?: () => void
}

export default function DraftList({ onRefresh }: DraftListProps) {
  const [drafts, setDrafts] = useState<EmailDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDrafts()
  }, [])

  const fetchDrafts = async () => {
    try {
      setLoading(true)
      const data = await getDrafts()
      setDrafts(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch drafts:', err)
      setError('Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchDrafts()
    onRefresh?.()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'status-created'
      case 'sent': return 'status-sent'
      case 'deleted': return 'status-deleted'
      case 'failed': return 'status-failed'
      default: return ''
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="draft-list loading">
        <div className="spinner"></div>
        <p>Loading drafts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="draft-list error">
        <p>{error}</p>
        <button onClick={fetchDrafts}>Retry</button>
      </div>
    )
  }

  return (
    <div className="draft-list">
      <div className="draft-list-header">
        <h2>Email Drafts</h2>
        <button className="refresh-btn" onClick={handleRefresh}>
          🔄 Refresh
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="draft-empty">
          <div className="empty-icon">📤</div>
          <h3>No drafts yet</h3>
          <p>Compose an email to create your first Gmail draft</p>
        </div>
      ) : (
        <div className="draft-table-container">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(draft => (
                <tr key={draft.id}>
                  <td className="recipient-cell">
                    <span className="recipient-name">{draft.to_name || 'Unknown'}</span>
                    <span className="recipient-email">{draft.to_email}</span>
                  </td>
                  <td className="subject-cell">{draft.subject}</td>
                  <td>
                    <span className={`draft-status ${getStatusColor(draft.status)}`}>
                      {draft.status}
                    </span>
                  </td>
                  <td className="date-cell">{formatDate(draft.created_at)}</td>
                  <td>
                    {draft.gmail_draft_id && (
                      <a
                        href={`https://mail.google.com/mail/u/0/#drafts/${draft.gmail_message_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gmail-link"
                      >
                        Open in Gmail
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
