import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(rootDir, './src') } },
  server: {
    fs: {
      // Allow importing brand logos from the monorepo root (logo.png, hbl.png).
      allow: [path.resolve(rootDir, '..')],
    },
  },
})
