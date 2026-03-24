import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9116,
    host: true,
    allowedHosts: [
      'local.obsidian.doi.bio',
      'localhost',
      '127.0.0.1',
      '.doi.bio'
    ],
    hmr: {
      host: 'localhost',
      port: 9116
    }
  },
})
