import { useState, useEffect, useCallback } from 'react'
import { getParties, type Party } from '../lib/api'
import './RecipientPicker.css'

interface RecipientPickerProps {
  selectedIds?: string[]
  onSelect?: (parties: Party[]) => void
  multiple?: boolean
}

export default function RecipientPicker({ selectedIds = [], onSelect, multiple = false }: RecipientPickerProps) {
  const [parties, setParties] = useState<Party[]>([])
  const [filteredParties, setFilteredParties] = useState<Party[]>([])
  const [selected, setSelected] = useState<Party[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchParties()
  }, [])

  useEffect(() => {
    if (search.trim()) {
      const query = search.toLowerCase()
      setFilteredParties(
        parties.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.email?.toLowerCase().includes(query)
        )
      )
    } else {
      setFilteredParties(parties)
    }
  }, [search, parties])

  const fetchParties = async () => {
    try {
      setLoading(true)
      const data = await getParties()
      // Filter to only parties with email
      const withEmail = data.filter(p => p.email)
      setParties(withEmail)
      setFilteredParties(withEmail)

      // Set initially selected
      if (selectedIds.length > 0) {
        setSelected(withEmail.filter(p => selectedIds.includes(p.id)))
      }

      setError(null)
    } catch (err) {
      console.error('Failed to fetch parties:', err)
      setError('Failed to load recipients')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = useCallback((party: Party) => {
    setSelected(prev => {
      const isSelected = prev.some(p => p.id === party.id)
      let next: Party[]

      if (isSelected) {
        next = prev.filter(p => p.id !== party.id)
      } else if (multiple) {
        next = [...prev, party]
      } else {
        next = [party]
      }

      onSelect?.(next)
      return next
    })
  }, [multiple, onSelect])

  const isSelected = (party: Party) => selected.some(p => p.id === party.id)

  if (loading) {
    return (
      <div className="recipient-picker loading">
        <div className="spinner-small"></div>
        <span>Loading recipients...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="recipient-picker error">
        <span>{error}</span>
        <button onClick={fetchParties}>Retry</button>
      </div>
    )
  }

  return (
    <div className="recipient-picker">
      <div className="picker-header">
        <input
          type="text"
          className="picker-search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.length > 0 && (
          <span className="selection-count">
            {selected.length} selected
          </span>
        )}
      </div>

      {selected.length > 0 && (
        <div className="selected-recipients">
          {selected.map(party => (
            <div key={party.id} className="selected-chip">
              <span className="chip-name">{party.name}</span>
              <button
                className="chip-remove"
                onClick={() => toggleSelection(party)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="recipient-list">
        {filteredParties.length === 0 ? (
          <div className="no-results">
            No recipients found matching "{search}"
          </div>
        ) : (
          filteredParties.map(party => (
            <div
              key={party.id}
              className={`recipient-item ${isSelected(party) ? 'selected' : ''}`}
              onClick={() => toggleSelection(party)}
            >
              <div className="recipient-checkbox">
                {isSelected(party) && <span className="check">✓</span>}
              </div>
              <div className="recipient-info">
                <span className="recipient-name">{party.name}</span>
                <span className="recipient-email">{party.email}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
