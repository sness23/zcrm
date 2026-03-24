import { createClient } from '@supabase/supabase-js'
import { cookieStorage } from './cookie-storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with cookie-based storage for SSO across subdomains
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: cookieStorage,  // Use cookie storage for SSO!
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
