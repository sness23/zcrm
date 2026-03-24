import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import PartyLayout from './components/layout/PartyLayout'
import GraphView from './components/GraphView'
import doibioLogo from './assets/doibio.png'
import './App.css'

const queryClient = new QueryClient()

function getLoginUrl() {
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

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)

  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId)
  }

  const handleBackToList = () => {
    setSelectedPartyId(null)
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

  return (
    <div className="app flex flex-col h-screen">
      <header className="app-header flex-shrink-0">
        <div className="header-content">
          <div className="header-left">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="App Logo" className="app-logo" />
            </a>
            <div className="header-text">
              <h1>party</h1>
              <div className="header-subtitle">Customer 360 Unified Profiles</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden" style={{ height: '100%' }}>
        {selectedPartyId ? (
          <PartyLayout partyId={selectedPartyId} onBack={handleBackToList} />
        ) : (
          <GraphView onSelectParty={handleSelectParty} />
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppContent />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  )
}
