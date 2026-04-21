import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbs = (p) => path.resolve(__dirname, p);

async function prerender() {
    // 1. Read the template index.html from dist
    const template = fs.readFileSync(toAbs('../dist/index.html'), 'utf-8');

    // 2. Load the server entry
    // Note: We need to build the server bundle first
    const { render } = await import('../dist/server/entry-server.js');

    // 3. Render the app
    const appHtml = render();

    // 4. Inject the rendered HTML into the template
    const html = template.replace(`<!--ssr-outlet-->`, appHtml);

    // 5. Write the final HTML back to dist/index.html
    fs.writeFileSync(toAbs('../dist/index.html'), html);

    console.log('Successfully prerendered index.html');
}

prerender();
