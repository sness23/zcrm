import { useState, useEffect } from 'react'
import './App.css'
import doibioLogo from './assets/doibio.png'

interface Lead {
  id: string
  name: string
  email?: string
  company?: string
  status?: string
}

interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  account_id?: string
  company?: string
  status?: string
}

type Entity = (Lead | Contact) & { type: 'lead' | 'contact' }

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

  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'all' | 'leads' | 'contacts'>('all')
  const [headerVisible, setHeaderVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('ads-app-header-visible')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    fetchData()
  }, [])

  // Keyboard shortcut: Ctrl+Shift+Y to toggle header
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        setHeaderVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Persist header visibility to localStorage
  useEffect(() => {
    localStorage.setItem('ads-app-header-visible', JSON.stringify(headerVisible))
  }, [headerVisible])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch leads and contacts from the API
      const [leadsRes, contactsRes] = await Promise.all([
        fetch('/api/entities/leads'),
        fetch('/api/entities/contacts')
      ])

      const leadsData = await leadsRes.json()
      const contactsData = await contactsRes.json()

      const allEntities: Entity[] = [
        ...(leadsData.entities || []).map((e: any) => ({ ...e, type: 'lead' as const })),
        ...(contactsData.entities || []).map((e: any) => ({ ...e, type: 'contact' as const }))
      ]

      setEntities(allEntities)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntities = entities.filter(entity => {
    if (view === 'all') return true
    return entity.type === view.slice(0, -1) // 'leads' -> 'lead'
  })

  if (loading) {
    return (
      <div className="app">
        {headerVisible && (
          <div className="header">
            <div className="header-content">
              <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
                <img src={doibioLogo} alt="doi.bio" className="logo" />
              </a>
              <div className="header-text">
                <h1>Ads Portal</h1>
                <p className="tagline">Helpful, Transparent Advertising</p>
              </div>
            </div>
          </div>
        )}
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="app">
      {headerVisible && (
        <div className="header">
          <div className="header-content">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="doi.bio" className="logo" />
            </a>
            <div className="header-text">
              <h1>Ads Portal</h1>
              <p className="tagline">Helpful, Transparent Advertising</p>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={view === 'all' ? 'active' : ''}
          onClick={() => setView('all')}
        >
          All ({entities.length})
        </button>
        <button
          className={view === 'leads' ? 'active' : ''}
          onClick={() => setView('leads')}
        >
          Leads ({entities.filter(e => e.type === 'lead').length})
        </button>
        <button
          className={view === 'contacts' ? 'active' : ''}
          onClick={() => setView('contacts')}
        >
          Contacts ({entities.filter(e => e.type === 'contact').length})
        </button>
      </div>

      <div className="content">
        {selectedEntity ? (
          <div className="detail-view">
            <button className="back-button" onClick={() => setSelectedEntity(null)}>
              ← Back to List
            </button>

            <div className="entity-detail">
              <div className="entity-header">
                <span className={`badge ${selectedEntity.type}`}>
                  {selectedEntity.type}
                </span>
                <h2>{selectedEntity.name}</h2>
              </div>

              <div className="entity-fields">
                <div className="field">
                  <label>ID</label>
                  <span className="id">{selectedEntity.id}</span>
                </div>

                {selectedEntity.type === 'lead' && (
                  <>
                    {selectedEntity.email && (
                      <div className="field">
                        <label>Email</label>
                        <span>{selectedEntity.email}</span>
                      </div>
                    )}
                    {selectedEntity.company && (
                      <div className="field">
                        <label>Company</label>
                        <span>{selectedEntity.company}</span>
                      </div>
                    )}
                    {selectedEntity.status && (
                      <div className="field">
                        <label>Status</label>
                        <span className="status">{selectedEntity.status}</span>
                      </div>
                    )}
                  </>
                )}

                {selectedEntity.type === 'contact' && (
                  <>
                    {selectedEntity.email && (
                      <div className="field">
                        <label>Email</label>
                        <span>{selectedEntity.email}</span>
                      </div>
                    )}
                    {(selectedEntity as Contact).phone && (
                      <div className="field">
                        <label>Phone</label>
                        <span>{(selectedEntity as Contact).phone}</span>
                      </div>
                    )}
                    {(selectedEntity as Contact).account_id && (
                      <div className="field">
                        <label>Account ID</label>
                        <span className="id">{(selectedEntity as Contact).account_id}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="ad-section">
                <h3>Ad Opportunities</h3>
                <p className="coming-soon">
                  Coming soon: AI-generated helpful ads based on this entity's context
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="list-view">
            {filteredEntities.length === 0 ? (
              <div className="empty-state">
                <p>No {view === 'all' ? 'entities' : view} found</p>
                <button onClick={fetchData}>Refresh</button>
              </div>
            ) : (
              <div className="entity-list">
                {filteredEntities.map(entity => (
                  <div
                    key={entity.id}
                    className="entity-card"
                    onClick={() => setSelectedEntity(entity)}
                  >
                    <div className="entity-card-header">
                      <span className={`badge ${entity.type}`}>
                        {entity.type}
                      </span>
                      <h3>{entity.name}</h3>
                    </div>

                    <div className="entity-card-info">
                      {entity.email && <span className="email">{entity.email}</span>}
                      {entity.type === 'lead' && entity.company && (
                        <span className="company">{entity.company}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
