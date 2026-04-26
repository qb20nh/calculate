import { spawn } from "node:child_process";
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

const startPreview = () => {
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "0.0.0.0"]);

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  return child;
};

const waitForPreview = async (
  previewProcess: ReturnType<typeof startPreview>,
  getBaseUrl: () => string | undefined,
) => {
  const deadline = Date.now() + 30_000;
  let resolvedBaseUrl: string | undefined;

  while (Date.now() < deadline) {
    if (previewProcess.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${previewProcess.exitCode}`);
    }

    try {
      const baseUrl = getBaseUrl();
      if (!baseUrl) {
        await delay(100);
        continue;
      }

      resolvedBaseUrl = baseUrl;
      const response = await fetch(baseUrl);
      if (response.ok || response.status === 404) return;
    } catch {
      // retry until ready
    }

    await delay(250);
  }

  throw new Error(`Preview server did not become ready at ${resolvedBaseUrl ?? "unknown URL"}`);
};

export default async function globalSetup() {
  setupPromise ??= (async () => {
    await run("pnpm", ["build"]);
    let baseUrl: string | undefined;
    const preview = startPreview();

    preview.stdout?.on("data", (chunk) => {
      const output = chunk.toString();
      const match = output.match(/http:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//);
      if (match) {
        baseUrl = `http://127.0.0.1:${match[1]}`;
        process.env.VITEST_PREVIEW_URL = baseUrl;
      }
    });

    await waitForPreview(preview, () => baseUrl);

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
