import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toAbs = (p) => path.resolve(__dirname, p)

async function prerender() {
  const templatePath = toAbs('../dist/index.html')
  const serverEntryPath = toAbs('../dist/server/entry-server.js')

  // 1. Verify existence of required files
  if (!fs.existsSync(templatePath)) {
    console.error(`Error: Template file not found at ${templatePath}. Did you run 'npm run build'?`)
    process.exit(1)
  }

  if (!fs.existsSync(serverEntryPath)) {
    console.error(`Error: Server entry not found at ${serverEntryPath}. Did you run 'npm run build'?`)
    process.exit(1)
  }

  try {
    // 2. Read the template index.html from dist
    const template = fs.readFileSync(templatePath, 'utf-8')

    // 3. Load the server entry
    // Note: We need to build the server bundle first
    const { render } = await import(serverEntryPath)

    if (typeof render !== 'function') {
      throw new TypeError(`The server entry at ${serverEntryPath} does not export a "render" function.`)
    }

    // 4. Render the app
    const appHtml = render()

    // 5. Inject the rendered HTML into the template
    const html = template.replace('<!--ssr-outlet-->', appHtml)

    // 6. Write the final HTML back to dist/index.html
    fs.writeFileSync(templatePath, html)

    console.log('Successfully prerendered index.html')
  } catch (err) {
    console.error('Prerender failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

await prerender()
