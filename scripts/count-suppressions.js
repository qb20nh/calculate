import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.github',
  'public',
  'report',
  'scripts'
])

const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const SUPPRESSION_TYPES = {
  'eslint-disable': /eslint-disable\b(?!-next-line|-line)/g,
  'eslint-disable-next-line': /eslint-disable-next-line/g,
  'eslint-disable-line': /eslint-disable-line/g,
  '@ts-ignore': /@ts-ignore/g,
  '@ts-expect-error': /@ts-expect-error/g,
  '@ts-nocheck': /@ts-nocheck/g
}

const fileResults = {}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        scanDirectory(fullPath)
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (VALID_EXTENSIONS.has(ext)) {
        analyzeFile(fullPath)
      }
    }
  }
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(rootDir, filePath)

  Object.entries(SUPPRESSION_TYPES).forEach(([type, regex]) => {
    // Reset regex state since we use the /g flag
    regex.lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      // Calculate line and column
      const linesToMatch = content.substring(0, match.index).split('\n')
      const line = linesToMatch.length
      const column = linesToMatch[linesToMatch.length - 1].length + 1

      const locationKey = `${relativePath}:${line}:${column}`

      if (!fileResults[locationKey]) {
        fileResults[locationKey] = {}
        // Initialize all types to 0 for this specific location
        Object.keys(SUPPRESSION_TYPES).forEach((t) => {
          fileResults[locationKey][t] = 0
        })
      }

      fileResults[locationKey][type]++
    }
  })
}

// Run scanner
scanDirectory(rootDir)

console.log('\n🔍 Codebase Suppression Analysis:')
if (Object.keys(fileResults).length === 0) {
  console.log('No suppressions found in the codebase!')
} else {
  console.table(fileResults)
}
