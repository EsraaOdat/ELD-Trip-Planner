import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the Django API runs on port 8000.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
