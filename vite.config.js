import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ReactCompilerConfig = {
  target: '19' // Target React 19
}

export default defineConfig({
  base: '/calculate/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]]
      }
    }),
    legacy()
  ],
  build: {
    modulePreload: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'react-vendor'
            }
            if (id.includes('lucide-react/')) {
              return 'ui-vendor'
            }
            return 'vendor'
          }
        }
      }
    }
  }
})
