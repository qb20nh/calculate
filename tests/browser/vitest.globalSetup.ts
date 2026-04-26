import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let setupPromise: Promise<(() => Promise<void>) | undefined> | undefined;
const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const viteBin = resolve(dirname(vitePackagePath), "bin", "vite.js");

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

const previewPort = 4173;
const previewBaseUrl = `http://127.0.0.1:${previewPort}${getBasePath()}`;
const hasBuiltDist = async () => {
  try {
    await access("dist/index.html");
    return true;
  } catch {
    return false;
  }
};

const startPreview = () => {
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

const waitForPreview = async (previewProcess: ReturnType<typeof startPreview>) => {
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
    if (!(await hasBuiltDist())) {
      await run("pnpm", ["build"]);
    }
    const preview = startPreview();
    process.env.VITEST_PREVIEW_URL = previewBaseUrl;
    await waitForPreview(preview);

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
