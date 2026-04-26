import { access, copyFile, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, type Plugin, type ResolvedConfig } from "vite";

const LEGACY_BUILD_ENV = "CALCULATE_LEGACY_BUILD";

interface LegacyScript {
  tag: string;
  inHead: boolean;
}

function extractLegacyScripts(html: string) {
  const scripts: LegacyScript[] = [];
  const scriptRe = /<script\b[\s\S]*?<\/script>/gi;
  const headClose = html.indexOf("</head>");

  for (const match of html.matchAll(scriptRe)) {
    const tag = match[0];
    const lower = tag.toLowerCase();
    if (
      !(
        lower.includes("nomodule") ||
        lower.includes("vite-legacy") ||
        lower.includes("system.import") ||
        lower.includes("__vite_legacy_guard") ||
        lower.includes("__vite_is_modern_browser")
      )
    ) {
      continue;
    }

    scripts.push({
      tag,
      inHead: headClose !== -1 && (match.index ?? 0) < headClose,
    });
  }

  return {
    head: scripts.filter((item) => item.inHead).map((item) => item.tag),
    body: scripts.filter((item) => !item.inHead).map((item) => item.tag),
  };
}

async function copyLegacyAssets(legacyDir: string, distDir: string) {
  const assetsDir = join(legacyDir, "assets");
  const files = await readdir(assetsDir, { withFileTypes: true });
  await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.includes("legacy"))
      .map((entry) => copyFile(join(assetsDir, entry.name), join(distDir, "assets", entry.name))),
  );
}

async function findHtmlFiles(dir: string) {
  const htmlFiles: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(path);
      continue;
    }

    if (!entry.isDirectory()) continue;
    htmlFiles.push(...(await findHtmlFiles(path)));
  }

  return htmlFiles;
}

async function patchHtmlFiles(distDir: string, headScripts: string[], bodyScripts: string[]) {
  const htmlFiles = await findHtmlFiles(distDir);
  const headInsert = headScripts.length ? `\n${headScripts.join("\n")}\n` : "";
  const bodyInsert = bodyScripts.length ? `\n${bodyScripts.join("\n")}\n` : "";

  await Promise.all(
    htmlFiles.map(async (file) => {
      const html = await readFile(file, "utf8");
      const patched = html
        .replace("</head>", `${headInsert}</head>`)
        .replace("</body>", `${bodyInsert}</body>`);
      await writeFile(file, patched);
    }),
  );
}

async function copyRoot404Fallback(distDir: string) {
  const root404 = join(distDir, "404.html");
  try {
    await access(root404);
  } catch {
    await copyFile(join(distDir, "404", "index.html"), root404);
  }
}

async function assertLegacyOutput(distDir: string) {
  const assets = await readdir(join(distDir, "assets"));
  if (!assets.some((file) => file.startsWith("polyfills-legacy-"))) {
    throw new Error("Legacy build did not emit a polyfills-legacy asset.");
  }
  if (!assets.some((file) => file.includes("index-legacy-"))) {
    throw new Error("Legacy build did not emit an index-legacy asset.");
  }

  const htmlFiles = await findHtmlFiles(distDir);
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    if (!html.includes("vite-legacy-polyfill") || !html.includes("vite-legacy-entry")) {
      throw new Error(`Legacy scripts were not injected into ${file}.`);
    }
  }
}

async function runLegacyBuild(config: ResolvedConfig, outDir: string) {
  const previous = process.env[LEGACY_BUILD_ENV];
  process.env[LEGACY_BUILD_ENV] = "1";

  try {
    await build({
      root: config.root,
      mode: config.mode,
      ...(config.configFile ? { configFile: config.configFile } : {}),
      ...(config.logLevel ? { logLevel: config.logLevel } : {}),
      build: {
        outDir,
        emptyOutDir: true,
      },
    });
  } finally {
    if (previous === undefined) {
      delete process.env[LEGACY_BUILD_ENV];
    } else {
      process.env[LEGACY_BUILD_ENV] = previous;
    }
  }
}

export function legacyPrerenderPlugin(): Plugin {
  let config: ResolvedConfig;
  let legacyDir: string | null = null;
  let legacyBuildPromise: Promise<void> | null = null;

  return {
    name: "calculate:legacy-prerender",
    apply: "build",
    enforce: "post",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async buildStart() {
      if (process.env[LEGACY_BUILD_ENV] === "1") return;

      legacyDir = await mkdtemp(join(tmpdir(), "calculate-legacy-"));
      legacyBuildPromise = runLegacyBuild(config, legacyDir);
      await legacyBuildPromise;
    },
    async closeBundle() {
      if (process.env[LEGACY_BUILD_ENV] === "1") return;

      if (!legacyDir || !legacyBuildPromise) {
        throw new Error("Legacy build was not started.");
      }

      const distDir = resolve(config.root, config.build.outDir);

      try {
        await legacyBuildPromise;

        const legacyHtml = await readFile(join(legacyDir, "index.html"), "utf8");
        const legacyScripts = extractLegacyScripts(legacyHtml);
        if (!legacyScripts.head.length && !legacyScripts.body.length) {
          throw new Error("Legacy build did not emit injectable legacy scripts.");
        }

        await copyLegacyAssets(legacyDir, distDir);
        await copyRoot404Fallback(distDir);
        await patchHtmlFiles(distDir, legacyScripts.head, legacyScripts.body);
        await assertLegacyOutput(distDir);
      } finally {
        await rm(legacyDir, { recursive: true, force: true });
      }
    },
  };
}
