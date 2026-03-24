import { createClient } from '@supabase/supabase-js'
import { cookieStorage } from './cookie-storage'

// These should be in environment variables in production
// For now using placeholders - you'll need to replace with your Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Create Supabase client with cookie-based storage for SSO across subdomains
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: cookieStorage,  // Use cookie storage for SSO!
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
