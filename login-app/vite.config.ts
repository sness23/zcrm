import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9103, // login.doi.bio runs on port 9103
    host: true,
    allowedHosts: [
      'local.login.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio' // Allow all *.doi.bio subdomains
    ],
    hmr: {
      host: 'localhost',
      port: 9103
    }
  },
})
