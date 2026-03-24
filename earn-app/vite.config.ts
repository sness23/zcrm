import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
    server: {
    port: 9104,
    host: true,
    allowedHosts: [
      'local.earn.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio' // Allow all *.doi.bio subdomains
    ],
    hmr: {
      host: 'localhost',
      port: 9104
    }
  }
})
