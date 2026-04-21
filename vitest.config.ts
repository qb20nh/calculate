import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // @ts-ignore - babel property exists at runtime but may not be recognized by current type definitions
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { target: '19' }],
        ],
      },
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
});
