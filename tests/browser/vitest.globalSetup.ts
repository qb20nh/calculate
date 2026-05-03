import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ensureFreshBuild } from "../../scripts/buildCache.mjs";

let setupPromise: Promise<(() => Promise<void>) | undefined> | undefined;
const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const viteBin = resolve(dirname(vitePackagePath), "bin", "vite.js");

const getBasePath = () =>
  process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/";

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

const stopPreview = async (previewProcess: ReturnType<typeof startPreview>) => {
  if (previewProcess.exitCode !== null || previewProcess.signalCode !== null) return;

  await new Promise<void>((resolve) => {
    const cleanup = () => resolve();

    previewProcess.once("exit", cleanup);
    previewProcess.once("close", cleanup);

    const stopNow = previewProcess.kill("SIGTERM");
    if (!stopNow) {
      previewProcess.off("exit", cleanup);
      previewProcess.off("close", cleanup);
      resolve();
    }
  });
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
    await ensureFreshBuild();
    const previewPort = await getFreePort();
    const previewBaseUrl = new URL(getBasePath(), `http://127.0.0.1:${previewPort}`).toString();
    const preview = startPreview(previewPort);
    process.env.VITEST_PREVIEW_URL = previewBaseUrl;
    await waitForPreview(preview, previewBaseUrl);

    return async () => {
      await stopPreview(preview);
    };
  })().catch((error) => {
    setupPromise = undefined;
    throw error;
  });

  return setupPromise;
}
