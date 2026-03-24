import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import AppLauncher from './pages/AppLauncher'
import Settings from './components/Settings'
import { useState } from 'react'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000040] via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (currentView === 'settings') {
    return <Settings onBack={() => setCurrentView('main')} />
  }

  return <AppLauncher onSettingsClick={() => setCurrentView('settings')} />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
