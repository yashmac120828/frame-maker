import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// These headers allow multi-threaded AI (faster on CPU)
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  server: { headers: isolation },
  preview: { headers: isolation },
})