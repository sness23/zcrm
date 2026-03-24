import { useState, useEffect } from 'react'
import { getGmailStatus, getGmailAuthUrl, disconnectGmail, type GmailStatus } from '../lib/api'
import './GmailConnect.css'

export default function GmailConnect() {
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setLoading(true)
      const s = await getGmailStatus()
      setStatus(s)
      setError(null)
    } catch (err) {
      console.error('Failed to check Gmail status:', err)
      setError('Could not check Gmail connection status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    // Redirect to Gmail OAuth
    window.location.href = getGmailAuthUrl()
  }

  const handleDisconnect = async () => {
    try {
      setLoading(true)
      await disconnectGmail()
      setStatus({ connected: false })
    } catch (err) {
      console.error('Failed to disconnect Gmail:', err)
      setError('Failed to disconnect Gmail')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="gmail-connect loading">
        <div className="spinner-small"></div>
        <span>Checking Gmail connection...</span>
      </div>
    )
  }

  if (status?.connected) {
    return (
      <div className="gmail-connect connected">
        <div className="gmail-status">
          <span className="gmail-icon">📧</span>
          <div className="gmail-info">
            <span className="gmail-label">Connected as</span>
            <span className="gmail-email">{status.email}</span>
          </div>
        </div>
        <button className="gmail-disconnect-btn" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="gmail-connect disconnected">
      {error && <div className="gmail-error">{error}</div>}
      <div className="gmail-prompt">
        <span className="gmail-icon">📧</span>
        <div className="gmail-info">
          <span className="gmail-label">Connect Gmail</span>
          <span className="gmail-description">
            Connect your Gmail account to create email drafts
          </span>
        </div>
      </div>
      <button className="gmail-connect-btn" onClick={handleConnect}>
        Connect Gmail
      </button>
    </div>
  )
}
