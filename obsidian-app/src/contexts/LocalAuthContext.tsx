import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
  token: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'doibio_auth_token'
const COOKIE_NAME = 'doibio_auth_token'

function getCookieDomain(): string {
  const hostname = window.location.hostname
  if (hostname.endsWith('.doi.bio')) {
    return '.doi.bio'
  }
  return ''
}

function setAuthCookie(token: string): void {
  const domain = getCookieDomain()
  const domainAttr = domain ? `; domain=${domain}` : ''
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${COOKIE_NAME}=${token}${domainAttr}; path=/; expires=${expires}; samesite=lax${secure}`
}

function getAuthCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`))
  return match ? match[2] : null
}

function removeAuthCookie(): void {
  const domain = getCookieDomain()
  const domainAttr = domain ? `; domain=${domain}` : ''
  document.cookie = `${COOKIE_NAME}=; path=/${domainAttr}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    return getAuthCookie() || localStorage.getItem(TOKEN_KEY)
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const validateToken = async () => {
      const savedToken = getAuthCookie() || localStorage.getItem(TOKEN_KEY)
      if (!savedToken) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          setToken(savedToken)
          setAuthCookie(savedToken)
        } else {
          localStorage.removeItem(TOKEN_KEY)
          removeAuthCookie()
          setToken(null)
        }
      } catch (error) {
        console.error('Token validation error:', error)
        localStorage.removeItem(TOKEN_KEY)
        removeAuthCookie()
        setToken(null)
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Login failed' }
      }

      setAuthCookie(data.token)
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      return {}
    } catch (error: unknown) {
      console.error('Login error:', error)
      return { error: error instanceof Error ? error.message : 'Login failed' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      removeAuthCookie()
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    }
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        token,
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
