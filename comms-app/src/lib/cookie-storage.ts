/**
 * Cookie-based storage for Supabase auth SSO
 * Works across all *.doi.bio subdomains
 */

/**
 * Parse cookies from document.cookie string
 */
function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {}

  const cookies: Record<string, string> = {}
  const cookieString = document.cookie

  if (!cookieString) return cookies

  cookieString.split(';').forEach(cookie => {
    const [key, value] = cookie.split('=').map(c => c.trim())
    if (key && value) {
      cookies[key] = decodeURIComponent(value)
    }
  })

  return cookies
}

/**
 * Set a cookie with proper domain configuration
 */
function setCookie(key: string, value: string, options: {
  domain?: string
  path?: string
  maxAge?: number
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
} = {}) {
  if (typeof document === 'undefined') return

  const {
    domain = '.doi.bio',  // Parent domain for all subdomains
    path = '/',
    maxAge = 60 * 60 * 24 * 7, // 7 days
    secure = false, // Set to true in production with HTTPS
    sameSite = 'lax'
  } = options

  let cookieString = `${key}=${encodeURIComponent(value)}`
  cookieString += `; domain=${domain}`
  cookieString += `; path=${path}`
  cookieString += `; max-age=${maxAge}`
  cookieString += `; samesite=${sameSite}`

  if (secure) {
    cookieString += '; secure'
  }

  document.cookie = cookieString
}

/**
 * Delete a cookie
 */
function deleteCookie(key: string) {
  if (typeof document === 'undefined') return

  document.cookie = `${key}=; domain=.doi.bio; path=/; max-age=-1`
}

/**
 * Supabase-compatible storage interface using cookies
 * This allows session sharing across all *.doi.bio subdomains
 */
export const cookieStorage = {
  getItem: (key: string): string | null => {
    const cookies = parseCookies()
    return cookies[key] || null
  },

  setItem: (key: string, value: string): void => {
    setCookie(key, value)
  },

  removeItem: (key: string): void => {
    deleteCookie(key)
  }
}

/**
 * Helper to check if user is logged in
 */
export function hasAuthCookie(): boolean {
  const cookies = parseCookies()
  // Supabase stores session with keys like: sb-<project-ref>-auth-token
  return Object.keys(cookies).some(key => key.startsWith('sb-') && key.includes('-auth-token'))
}

/**
 * Helper to get all auth-related cookies
 */
export function getAuthCookies(): Record<string, string> {
  const cookies = parseCookies()
  const authCookies: Record<string, string> = {}

  Object.entries(cookies).forEach(([key, value]) => {
    if (key.startsWith('sb-')) {
      authCookies[key] = value
    }
  })

  return authCookies
}
