import { useState, useEffect } from 'react'
import type { Party } from '../types/party'

const API_BASE_URL = 'http://localhost:9600/api'

interface PartyListProps {
  onSelectParty: (partyId: string) => void
}

export default function PartyList({ onSelectParty }: PartyListProps) {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE_URL}/parties`)
      if (!response.ok) {
        throw new Error('Failed to fetch parties')
      }
      const data = await response.json()
      setParties(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (party: Party) => {
    onSelectParty(party.id)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const getPartyTypeIcon = (partyType: Party['partyType']) => {
    switch (partyType) {
      case 'individual':
        return '👤'
      case 'organization':
        return '🏢'
      case 'household':
        return '🏠'
      default:
        return '•'
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="loading">Loading parties...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-main">
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="app-main">
      {parties.length === 0 ? (
        <div className="empty-state">
          No parties found
        </div>
      ) : (
        <div className="table-view">
          <div className="table-header">
            <h2>Parties</h2>
            <div className="record-count">{parties.length} records</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Last Contact</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr
                  key={party.id}
                  onClick={() => handleRowClick(party)}
                >
                  <td>
                    <span title={party.partyType}>
                      {getPartyTypeIcon(party.partyType)}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{party.name}</div>
                    {party.title && (
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>{party.title}</div>
                    )}
                  </td>
                  <td>{party.role}</td>
                  <td>{party.email || '-'}</td>
                  <td>{party.phone || '-'}</td>
                  <td>{formatDate(party.lastContactedAt)}</td>
                  <td>{formatDate(party.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
