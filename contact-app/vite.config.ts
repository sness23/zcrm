import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
    server: {
    port: 9107,
    host: true,
    allowedHosts: [
      'local.contact.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio' // Allow all *.doi.bio subdomains
    ],
    hmr: {
      host: 'localhost',
      port: 9107
    }
  }
})
