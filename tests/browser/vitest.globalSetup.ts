import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let setupPromise: Promise<(() => Promise<void>) | undefined> | undefined;
const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const viteBin = resolve(dirname(vitePackagePath), "bin", "vite.js");
const buildStampPath = resolve("dist/.e2e-build-hash");
const buildRoots = ["build", "public", "src"];
const buildFiles = [
  "index.html",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.js",
  "tsconfig.json",
  "vite.config.ts",
];

const run = (command: string, args: string[], options: { stdio?: "inherit" | "pipe" } = {}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });

const getBasePath = () =>
  process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/";

const hasBuiltDist = async () => {
  try {
    await access("dist/index.html");
    return true;
  } catch {
    return false;
  }
};

const collectFiles = async (pathName: string, files: string[] = []) => {
  const entries = await readdir(pathName, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = resolve(pathName, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

const getBuildFingerprint = async () => {
  const files = [
    ...(await Promise.all(buildRoots.map((root) => collectFiles(root)))).flat(),
    ...buildFiles,
  ]
    .map((filePath) => resolve(filePath))
    .sort();

  const hash = createHash("sha256");
  for (const filePath of files) {
    const content = await readFile(filePath);
    const relativePath = filePath.startsWith(`${process.cwd()}/`)
      ? filePath.slice(process.cwd().length + 1)
      : filePath;
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }

  return hash.digest("hex");
};

const hasFreshDist = async () => {
  try {
    const [builtHash, currentHash] = await Promise.all([
      readFile(buildStampPath, "utf8"),
      getBuildFingerprint(),
    ]);
    return builtHash.trim() === currentHash;
  } catch {
    return false;
  }
};

const getFreePort = async () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine a free preview port"));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });

const startPreview = (previewPort: number) => {
  const child = spawn(process.execPath, [
    viteBin,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(previewPort),
    "--strictPort",
  ]);

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  return child;
};

const waitForPreview = async (
  previewProcess: ReturnType<typeof startPreview>,
  previewBaseUrl: string,
) => {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (previewProcess.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${previewProcess.exitCode}`);
    }

    try {
      const response = await fetch(previewBaseUrl);
      if (response.ok || response.status === 404) return;
    } catch {
      // retry until ready
    }

    await delay(250);
  }

  throw new Error(`Preview server did not become ready at ${previewBaseUrl}`);
};

export default async function globalSetup() {
  setupPromise ??= (async () => {
    if (!(await hasBuiltDist()) || !(await hasFreshDist())) {
      await run("pnpm", ["build"]);
      const buildHash = await getBuildFingerprint();
      await writeFile(buildStampPath, `${buildHash}\n`);
    }
    const previewPort = await getFreePort();
    const previewBaseUrl = new URL(getBasePath(), `http://127.0.0.1:${previewPort}`).toString();
    const preview = startPreview(previewPort);
    process.env.VITEST_PREVIEW_URL = previewBaseUrl;
    await waitForPreview(preview, previewBaseUrl);

    return async () => {
      if (!preview.killed) {
        preview.kill("SIGTERM");
      }
    };
  })().catch((error) => {
    setupPromise = undefined;
    throw error;
  });

  return setupPromise;
}
