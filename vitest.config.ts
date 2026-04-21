import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const skipCompiler = process.env.SKIP_COMPILER === 'true'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react({
      babel: skipCompiler
        ? {}
        : {
            plugins: [
              ['babel-plugin-react-compiler', { target: '19' }],
            ],
          }
    })
  ],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.tsx',
        '**/*.test.ts',
        'src/main.tsx',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    }
  }
})
