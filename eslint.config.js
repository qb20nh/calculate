import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import reactCompiler from 'eslint-plugin-react-compiler'
import eslintReact from '@eslint-react/eslint-plugin'
import tailwind from 'eslint-plugin-better-tailwindcss'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import html from '@html-eslint/eslint-plugin'
import js from '@eslint/js'
import neostandard from 'neostandard'
import { defineConfig } from 'eslint/config'
import { fixStylisticRules } from './scripts/eslint-v10-compat.js'

export default defineConfig([
  js.configs.recommended,
  {
    ignores: ['dist', 'report', 'coverage', 'scripts'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error'
    },
  },
  ...neostandard({ ts: true }).map(config => ({
    ...config,
    rules: fixStylisticRules(config.rules),
    files: ['**/*.{js,jsx,ts,tsx}'],
  })),
  ...tseslint.configs.recommendedTypeChecked.map(config => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...tailwind.configs.recommended,
    rules: {
      ...tailwind.configs.recommended.rules,
      'better-tailwindcss/enforce-consistent-line-wrapping': ['error', { strictness: 'loose' }],
    },
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['**/*.{js,jsx,ts,tsx}'],
  },
  {
    files: ['**/*.html'],
    plugins: {
      html,
    },
    language: 'html/html',
    rules: {
      ...html.configs.recommended.rules,
      'html/indent': ['error', 2],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-type-checked'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      tailwindcss: {
        entryPoint: 'src/style.css',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react-compiler': reactCompiler,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react-compiler/react-compiler': 'error',

      // Deprecation Warning
      '@typescript-eslint/no-deprecated': 'warn',

      // Custom Rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-void': ['error', { allowAsStatement: true }],

      // Import Sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
    },
  },
])
