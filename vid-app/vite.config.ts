import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9109,
    host: true,
    allowedHosts: [
      'local.vid.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio' // Allow all *.doi.bio subdomains
    ],
    hmr: {
      host: 'localhost',
      port: 9109
    },
    watch: {
      // Ignore vault directory to avoid hitting file watcher limits
      ignored: ['**/public/vault/**', '**/node_modules/**']
    }
  },
  publicDir: 'public',
})
