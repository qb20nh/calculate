import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
	plugins: [preact()],
	test: {
		environment: 'jsdom',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
			exclude: [
				'node_modules/**',
				'dist/**',
				'**/*.d.ts',
				'**/*.test.tsx',
				'**/*.test.ts',
				'src/index.tsx',
				'vite.config.ts',
				'vitest.config.ts',
			],
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
