import Keycloak from 'keycloak-js'

// Keycloak configuration
const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'doibio',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'doibio-web',
}

// Create Keycloak instance
export const keycloak = new Keycloak(keycloakConfig)

// Check if we're in a secure context (localhost or HTTPS)
const isSecureContext = window.isSecureContext ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

// Initialize options - disable PKCE if not in secure context (Web Crypto unavailable)
export const initOptions = {
  onLoad: 'check-sso' as const,
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: isSecureContext ? 'S256' as const : undefined,
  checkLoginIframe: false, // Disable iframe check for better cross-origin support
  enableLogging: true,
}

// Token refresh interval (in milliseconds)
const TOKEN_MIN_VALIDITY = 30 // seconds

// Set up automatic token refresh
export function setupTokenRefresh() {
  setInterval(async () => {
    if (keycloak.authenticated) {
      try {
        const refreshed = await keycloak.updateToken(TOKEN_MIN_VALIDITY)
        if (refreshed) {
          console.log('Token refreshed')
        }
      } catch (error) {
        console.error('Failed to refresh token:', error)
        // Token refresh failed, redirect to login
        keycloak.login()
      }
    }
  }, (TOKEN_MIN_VALIDITY - 5) * 1000) // Refresh 5 seconds before min validity
}

// Helper to get authorization header
export function getAuthHeader(): { Authorization: string } | {} {
  if (keycloak.token) {
    return { Authorization: `Bearer ${keycloak.token}` }
  }
  return {}
}

// Extract user info from token
export interface KeycloakUser {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  username: string
  roles: string[]
}

export function getCurrentUser(): KeycloakUser | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null
  }

  const token = keycloak.tokenParsed as {
    sub: string
    email?: string
    name?: string
    given_name?: string
    family_name?: string
    preferred_username?: string
    realm_access?: { roles: string[] }
  }

  return {
    id: token.sub,
    email: token.email || '',
    name: token.name || token.preferred_username || '',
    firstName: token.given_name,
    lastName: token.family_name,
    username: token.preferred_username || '',
    roles: token.realm_access?.roles || [],
  }
}
