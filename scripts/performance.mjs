#!/usr/bin/env node
// @ts-nocheck
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { ensureFreshBuild } from "./buildCache.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve("vite/package.json");
const viteBin = resolve(dirname(vitePackagePath), "bin", "vite.js");

export const LCP_LIMIT_MS = 2500;
export const CLS_LIMIT = 0.1;
export const NETWORK_THROTTLE = {
  downloadThroughput: ((500 * 1000) / 8) * 0.8,
  label: "3G",
  latency: 400 * 5,
  uploadThroughput: ((500 * 1000) / 8) * 0.8,
};
const ROUTE_SETTLE_TIMEOUT_MS = 30000;
const METRIC_SETTLE_MS = 600;
const routes = [{ path: "/", label: "root", readyText: "Math Crossword" }];

const getBasePath = () =>
  process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/";

const getFreePort = async () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine a free preview port"));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolvePort(port);
      });
    });
  });

const startPreview = (previewPort) => {
  const child = spawn(
    process.execPath,
    [viteBin, "preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"],
    {
      cwd: repoRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  return child;
};

const stopPreview = async (previewProcess) => {
  if (previewProcess.exitCode !== null || previewProcess.signalCode !== null) return;

  await new Promise((resolveStop) => {
    const cleanup = () => resolveStop();

    previewProcess.once("exit", cleanup);
    previewProcess.once("close", cleanup);

    const stopNow = previewProcess.kill("SIGTERM");
    if (!stopNow) {
      previewProcess.off("exit", cleanup);
      previewProcess.off("close", cleanup);
      resolveStop();
    }
  });
};

const waitForPreview = async (previewProcess, previewBaseUrl) => {
  const deadline = Date.now() + ROUTE_SETTLE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (previewProcess.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${previewProcess.exitCode}`);
    }

    try {
      const response = await fetch(previewBaseUrl);
      if (response.ok || response.status === 404) return;
    } catch {
      // Retry until preview is ready.
    }

    await delay(250);
  }

  throw new Error(`Preview server did not become ready at ${previewBaseUrl}`);
};

const installMetricObservers = async (page) => {
  await page.addInitScript(() => {
    window.__calculatePerformanceMetrics = {
      cls: 0,
      clsEntries: [],
      errors: [],
      lcp: undefined,
      lcpEntries: [],
      observerTypes: [],
      stop() {
        for (const observer of this.observers ?? []) observer.disconnect();
      },
      observers: [],
    };

    const metrics = window.__calculatePerformanceMetrics;
    if (!("PerformanceObserver" in window)) {
      metrics.errors.push("PerformanceObserver is not available");
      return;
    }

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const candidate = entry;
          const startTime =
            typeof candidate.renderTime === "number" && candidate.renderTime > 0
              ? candidate.renderTime
              : candidate.startTime;
          metrics.lcp = startTime;
          metrics.lcpEntries.push({
            className:
              candidate.element instanceof HTMLElement ? candidate.element.className : undefined,
            element:
              candidate.element instanceof HTMLElement
                ? candidate.element.tagName.toLowerCase()
                : undefined,
            id: candidate.id,
            loadTime: candidate.loadTime,
            renderTime: candidate.renderTime,
            size: candidate.size,
            startTime,
            url: candidate.url,
          });
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      metrics.observers.push(lcpObserver);
      metrics.observerTypes.push("largest-contentful-paint");
    } catch (error) {
      metrics.errors.push(
        `largest-contentful-paint observer failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      let sessionValue = 0;
      let sessionStart = 0;
      let sessionEnd = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry;
          if (shift.hadRecentInput) continue;

          if (
            sessionValue === 0 ||
            shift.startTime - sessionEnd > 1000 ||
            shift.startTime - sessionStart > 5000
          ) {
            sessionValue = shift.value;
            sessionStart = shift.startTime;
          } else {
            sessionValue += shift.value;
          }

          sessionEnd = shift.startTime;
          metrics.cls = Math.max(metrics.cls, sessionValue);
          metrics.clsEntries.push({
            startTime: shift.startTime,
            value: shift.value,
          });
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      metrics.observers.push(clsObserver);
      metrics.observerTypes.push("layout-shift");
    } catch (error) {
      metrics.errors.push(
        `layout-shift observer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
};

const waitForRouteSettled = async (page, expectedText) => {
  await page.waitForFunction(
    (text) => {
      const appWindow = window;
      if (appWindow.__APP_RENDER_ERROR__) return false;

      const bodyText = document.body.textContent ?? "";
      const hasRouteLoader =
        document.querySelector("#skeleton-progress") !== null ||
        document.querySelector("#skeleton-spinner") !== null;

      return appWindow.__APP_READY__ === true && bodyText.includes(text) && !hasRouteLoader;
    },
    expectedText,
    { timeout: ROUTE_SETTLE_TIMEOUT_MS },
  );
};

const collectMetrics = async (page) =>
  page.evaluate(async (metricSettleMs) => {
    await new Promise((resolveMetricSettle) => setTimeout(resolveMetricSettle, metricSettleMs));
    const metrics = window.__calculatePerformanceMetrics;
    metrics?.stop?.();
    return metrics;
  }, METRIC_SETTLE_MS);

export const applyNetworkThrottle = async (page) => {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", {
    cacheDisabled: true,
  });
  await client.send("Network.setBypassServiceWorker", {
    bypass: true,
  });
  await client.send("Network.emulateNetworkConditions", {
    connectionType: "cellular3g",
    downloadThroughput: NETWORK_THROTTLE.downloadThroughput,
    latency: NETWORK_THROTTLE.latency,
    offline: false,
    uploadThroughput: NETWORK_THROTTLE.uploadThroughput,
  });
  return client;
};

export const assertRouteMetrics = (route, metrics, consoleErrors, pageErrors) => {
  const failures = [];
  if (!metrics) failures.push("metric observer state was not initialized");
  if (consoleErrors.length > 0)
    failures.push(`browser console errors: ${consoleErrors.join(" | ")}`);
  if (pageErrors.length > 0) failures.push(`page errors: ${pageErrors.join(" | ")}`);

  if (metrics) {
    if (metrics.errors.length > 0) failures.push(metrics.errors.join(" | "));
    if (!metrics.observerTypes.includes("largest-contentful-paint")) {
      failures.push("largest-contentful-paint observer did not start");
    }
    if (!metrics.observerTypes.includes("layout-shift")) {
      failures.push("layout-shift observer did not start");
    }
    if (typeof metrics.lcp !== "number" || !Number.isFinite(metrics.lcp)) {
      failures.push("LCP measurement failed: no largest-contentful-paint entry was recorded");
    } else if (metrics.lcp >= LCP_LIMIT_MS) {
      failures.push(`LCP ${metrics.lcp.toFixed(1)}ms exceeded < ${LCP_LIMIT_MS}ms`);
    }
    if (typeof metrics.cls !== "number" || !Number.isFinite(metrics.cls)) {
      failures.push("CLS measurement failed: layout-shift score was not numeric");
    } else if (metrics.cls >= CLS_LIMIT) {
      failures.push(`CLS ${metrics.cls.toFixed(6)} exceeded < ${CLS_LIMIT}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`${route.label} performance failed:\n- ${failures.join("\n- ")}`);
  }
};

const measureRoute = async (browser, previewBaseUrl, route) => {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let throttleSession;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await installMetricObservers(page);
    throttleSession = await applyNetworkThrottle(page);
    await page.goto(new URL(route.path, previewBaseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: ROUTE_SETTLE_TIMEOUT_MS,
    });
    await page.waitForLoadState("load", { timeout: ROUTE_SETTLE_TIMEOUT_MS });
    await waitForRouteSettled(page, route.readyText);
    const metrics = await collectMetrics(page);
    assertRouteMetrics(route, metrics, consoleErrors, pageErrors);

    return {
      cls: metrics.cls,
      lcp: metrics.lcp,
      lcpEntries: metrics.lcpEntries.length,
      path: route.path,
    };
  } finally {
    await throttleSession?.detach();
    await context.close();
  }
};

const main = async () => {
  await ensureFreshBuild();

  const previewPort = await getFreePort();
  const previewBaseUrl = new URL(getBasePath(), `http://127.0.0.1:${previewPort}`).toString();
  const preview = startPreview(previewPort);
  let browser;

  try {
    await waitForPreview(preview, previewBaseUrl);
    browser = await chromium.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
      chromiumSandbox: false,
      headless: true,
    });

    for (const route of routes) {
      const metrics = await measureRoute(browser, previewBaseUrl, route);
      console.log(
        `${route.label} ${route.path} (${NETWORK_THROTTLE.label}): LCP ${metrics.lcp.toFixed(1)}ms (<${LCP_LIMIT_MS}ms), CLS ${metrics.cls.toFixed(6)} (<${CLS_LIMIT})`,
      );
    }
  } finally {
    await browser?.close();
    await stopPreview(preview);
  }
};

const isDirectRun = () => {
  const entry = process.argv[1];
  return !!entry && import.meta.url === pathToFileURL(resolve(entry)).href;
};

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
