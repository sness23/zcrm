import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { keycloak, initOptions, setupTokenRefresh, getCurrentUser, type KeycloakUser } from '../lib/keycloak'

interface AuthContextType {
  user: KeycloakUser | null
  loading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  register: () => void
  token: string | undefined
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<KeycloakUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return

    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init(initOptions)

        if (authenticated) {
          setUser(getCurrentUser())
          setupTokenRefresh()
        }

        // Listen for auth events
        keycloak.onAuthSuccess = () => {
          setUser(getCurrentUser())
        }

        keycloak.onAuthLogout = () => {
          setUser(null)
        }

        keycloak.onTokenExpired = () => {
          keycloak.updateToken(30).catch(() => {
            console.error('Failed to refresh token on expiry')
            setUser(null)
          })
        }

        setInitialized(true)
      } catch (error) {
        console.error('Keycloak init failed:', error)
      } finally {
        setLoading(false)
      }
    }

    initKeycloak()
  }, [initialized])

  const login = useCallback(() => {
    keycloak.login()
  }, [])

  const logout = useCallback(() => {
    keycloak.logout({ redirectUri: window.location.origin })
  }, [])

  const register = useCallback(() => {
    keycloak.register()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        token: keycloak.token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
