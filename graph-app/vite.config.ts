import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9007,
    host: true,
    allowedHosts: [
      'local.graph.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio' // Allow all *.doi.bio subdomains
    ],
    hmr: {
      host: 'localhost',
      port: 9007
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9600',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:9600',
        ws: true
      }
    }
  }
})