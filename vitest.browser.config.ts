import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import UnpluginTypia from "@typia/unplugin/vite";
import { playwright } from "@vitest/browser-playwright";
import type { Page } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand, BrowserInstanceOption } from "vitest/node";

const browserMatrix: BrowserInstanceOption[] =
  process.env.ENABLE_BROWSER_MATRIX === "1"
    ? [
        { browser: "chromium", name: "chromium" },
        { browser: "firefox", name: "firefox" },
        { browser: "webkit", name: "webkit" },
      ]
    : [{ browser: "chromium", name: "chromium" }];

const browserConsoleState = new Map<
  string,
  {
    errors: string[];
    appPage?: Page;
    crashed?: boolean;
  }
>();
const isKnownHydrationMismatch = (text: string) =>
  text.includes("Expected a DOM node of type") &&
  text.includes(
    "this is caused by the SSR'd HTML containing different DOM-nodes compared to the hydrated one.",
  );

const isKnownJsxSourceHint = (text: string) =>
  text.includes("Add @babel/plugin-transform-react-jsx-source") &&
  text.includes("detailed component stack");

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
        timeoutHandle.unref?.();
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const waitForTwoFrames = async (page: Page) => {
  await withTimeout(
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        }),
    ),
    250,
    "Timed out waiting for the page to settle after render",
  );
};

const ROUTE_SETTLE_TIMEOUT_MS = 30000;

const expectedReadyRouteForPath = (path: string) => {
  const url = new URL(path, "http://localhost");
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (pathname === "/") return "menu";
  if (pathname === "/game/custom") {
    return url.searchParams.has("given") ? "game" : "custom-setup";
  }
  if (["/game/easy", "/game/medium", "/game/hard", "/game/crossing"].includes(pathname)) {
    return "game";
  }
  return "notfound";
};

const ensureAppPage = async ({ context, sessionId }: Parameters<BrowserCommand>[0]) => {
  const state = browserConsoleState.get(sessionId);
  if (!state) throw new Error("Browser console state not initialized");
  if (state.appPage) return state.appPage;

  const appPage = await context.newPage();
  state.appPage = appPage;

  appPage.on("console", (message) => {
    const text = message.text();
    const location = message.location();
    const prefix = location?.url
      ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
      : "";
    if (message.type() === "warning") {
      if (isKnownJsxSourceHint(text)) return;
      if (isKnownHydrationMismatch(text)) {
        state.errors.push(text);
      }
      process.stderr.write(`[browser warn] ${prefix ? `${prefix} ` : ""}${text}\n`);
    }
    if (message.type() === "error") {
      state.errors.push(text);
      process.stderr.write(`[browser error] ${prefix ? `${prefix} ` : ""}${text}\n`);
    }
  });

  appPage.on("pageerror", (error) => {
    const text = error.stack || error.message;
    state.errors.push(text);
    process.stderr.write(`[page error] ${text}\n`);
  });

  appPage.on("crash", () => {
    state.crashed = true;
    state.errors.push("Page crashed");
    process.stderr.write("[page crash] browser page crashed\n");
  });

  return appPage;
};

const captureBrowserConsole: BrowserCommand = async (context) => {
  const { sessionId } = context;
  if (browserConsoleState.has(sessionId)) return;

  browserConsoleState.set(sessionId, {
    errors: [] as string[],
    crashed: false,
  });

  await ensureAppPage(context);
};

const gotoRoute: BrowserCommand<[string]> = async (context, path) => {
  const previewBaseUrl = process.env.VITEST_PREVIEW_URL;
  if (!previewBaseUrl) throw new Error("Missing VITEST_PREVIEW_URL");
  const page = await ensureAppPage(context);
  const state = browserConsoleState.get(context.sessionId);
  if (!state) throw new Error("Browser console state not initialized");
  if (state.crashed || page.isClosed()) throw new Error("Browser page crashed or closed");
  await page.goto(new URL(path, previewBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
};

const waitForText: BrowserCommand<[string]> = async (context, text) => {
  const page = await ensureAppPage(context);
  const state = browserConsoleState.get(context.sessionId);
  if (!state) throw new Error("Browser console state not initialized");
  if (state.crashed || page.isClosed()) throw new Error("Browser page crashed or closed");

  await withTimeout(
    page.waitForFunction(
      (expectedText) => {
        const bodyText = document.body.textContent ?? "";
        const hasText = bodyText.includes(expectedText);
        const hasRouteLoader =
          document.querySelector("#skeleton-progress") !== null ||
          document.querySelector("#skeleton-spinner") !== null;

        return hasText && !hasRouteLoader;
      },
      text,
      { timeout: ROUTE_SETTLE_TIMEOUT_MS },
    ),
    ROUTE_SETTLE_TIMEOUT_MS,
    "Timed out waiting for route text to appear",
  );
};

const waitForAppSettled: BrowserCommand<[string]> = async (context, text) => {
  const page = await ensureAppPage(context);
  const state = browserConsoleState.get(context.sessionId);
  if (!state) throw new Error("Browser console state not initialized");
  if (state.crashed || page.isClosed()) throw new Error("Browser page crashed or closed");

  await withTimeout(
    page.waitForFunction(
      (expectedText: string) => {
        const appWindow = window as typeof window & {
          __APP_READY__?: boolean;
          __APP_RENDER_ERROR__?: string;
        };

        if (appWindow.__APP_RENDER_ERROR__) return false;
        if (!appWindow.__APP_READY__) return false;

        const bodyText = document.body.textContent ?? "";
        if (!bodyText.includes(expectedText)) return false;

        return (
          document.querySelector("#skeleton-progress") === null &&
          document.querySelector("#skeleton-spinner") === null
        );
      },
      text,
      { timeout: ROUTE_SETTLE_TIMEOUT_MS },
    ),
    ROUTE_SETTLE_TIMEOUT_MS,
    "Timed out waiting for the app to settle",
  );

  await waitForTwoFrames(page);
};

const waitForRouteSettled: BrowserCommand<[string, string]> = async (context, path, text) => {
  const page = await ensureAppPage(context);
  const state = browserConsoleState.get(context.sessionId);
  if (!state) throw new Error("Browser console state not initialized");
  if (state.crashed || page.isClosed()) throw new Error("Browser page crashed or closed");

  await withTimeout(
    page.waitForFunction(
      ({
        expectedText,
        currentPath,
        expectedReadyRoute,
      }: {
        expectedText: string;
        currentPath: string;
        expectedReadyRoute: string;
      }) => {
        const appWindow = window as typeof window & {
          __APP_READY__?: boolean;
          __APP_READY_ROUTE__?: string;
          __APP_RENDER_ERROR__?: string;
        };

        if (appWindow.__APP_RENDER_ERROR__) {
          throw new Error(`App render error: ${appWindow.__APP_RENDER_ERROR__}`);
        }
        if (!appWindow.__APP_READY__) return false;
        if (appWindow.__APP_READY_ROUTE__ !== expectedReadyRoute) return false;

        const bodyText = document.body.textContent ?? "";
        if (!bodyText.includes(expectedText)) return false;

        if (
          document.querySelector("#skeleton-progress") !== null ||
          document.querySelector("#skeleton-spinner") !== null ||
          document.querySelector("#custom-generation-spinner") !== null
        ) {
          return false;
        }

        const url = new URL(currentPath, "http://localhost");
        const pathname = url.pathname.replace(/\/$/, "") || "/";

        if (pathname === "/") {
          return document.querySelector("h1")?.textContent?.includes("Math Crossword") ?? false;
        }

        if (pathname === "/game/custom" && !url.searchParams.has("given")) {
          return document.querySelector("#custom-given-count") !== null;
        }

        if (pathname.startsWith("/game/") && pathname !== "/game") {
          // If it's a valid difficulty or a custom game with params
          const isKnownGameRoute = [
            "/game/easy",
            "/game/medium",
            "/game/hard",
            "/game/crossing",
            "/game/custom",
          ].includes(pathname);
          if (isKnownGameRoute && (pathname !== "/game/custom" || url.searchParams.has("given"))) {
            return document.querySelector('[data-testid="game-board-container"]') !== null;
          }
        }

        return document.querySelector("h1")?.textContent?.includes("Page not found") ?? false;
      },
      {
        expectedText: text,
        currentPath: path,
        expectedReadyRoute: expectedReadyRouteForPath(path),
      },
      { timeout: ROUTE_SETTLE_TIMEOUT_MS },
    ),
    ROUTE_SETTLE_TIMEOUT_MS + 2000,
    "Timed out waiting for the route to settle",
  );

  await waitForTwoFrames(page);
};

const clickButton: BrowserCommand<[string]> = async (context, name) => {
  const page = await ensureAppPage(context);
  await page.getByRole("button", { name }).click();
};

const clickButtonAndWaitForLoading: BrowserCommand<[string]> = async (context, name) => {
  const page = await ensureAppPage(context);
  const loadingPromise = page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Loading screen"]') !== null &&
      document.querySelector('[role="progressbar"]') !== null,
    undefined,
    { timeout: 1000 },
  );

  await page.getByRole("button", { name }).click();
  await loadingPromise;
};

const clickTestId: BrowserCommand<[string]> = async (context, testId) => {
  const page = await ensureAppPage(context);
  await page.getByTestId(testId).click();
};

const getComputedStyleValue: BrowserCommand<[string, string]> = async (
  context,
  selector,
  property,
) => {
  const page = await ensureAppPage(context);
  return page
    .locator(selector)
    .first()
    .evaluate((element, propertyName) => {
      return getComputedStyle(element).getPropertyValue(propertyName);
    }, property);
};

const fetchRouteHtmlSummary: BrowserCommand<[string]> = async (_context, path) => {
  const previewBaseUrl = process.env.VITEST_PREVIEW_URL;
  if (!previewBaseUrl) throw new Error("Missing VITEST_PREVIEW_URL");

  const response = await fetch(new URL(path, previewBaseUrl).toString());
  const html = await response.text();
  const appHtml = /<div id="app">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
  const firstAppClass = /class="([^"]+)"/.exec(appHtml)?.[1] ?? "";
  const bodyText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    bodyText,
    firstAppClass,
    hasCriticalCss: html.includes("data-critical-root"),
  };
};

const getLayoutShiftScore: BrowserCommand = async (context) => {
  const page = await ensureAppPage(context);
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        if (!("PerformanceObserver" in window)) {
          resolve(0);
          return;
        }

        let score = 0;
        let observer: PerformanceObserver | undefined;
        try {
          observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              if (!layoutShift.hadRecentInput) score += layoutShift.value ?? 0;
            }
          });
          observer.observe({ type: "layout-shift", buffered: true });
        } catch {
          resolve(0);
          return;
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            observer?.disconnect();
            resolve(Number(score.toFixed(6)));
          });
        });
      }),
  );
};

const resetAppState: BrowserCommand = async (context) => {
  const page = await ensureAppPage(context);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Could not clear storage:", e);
    }
  });
};

const drainBrowserConsoleErrors: BrowserCommand = ({ sessionId }) => {
  const state = browserConsoleState.get(sessionId);
  if (!state) return [];

  const errors = state.errors.slice();
  state.errors.length = 0;
  return errors;
};

export default defineConfig({
  plugins: [UnpluginTypia({ tsconfig: "./tsconfig.json" }), preact()],
  test: {
    name: "browser",
    include: [
      "tests/browser/**/*.test.ts",
      "tests/browser/**/*.spec.ts",
      "tests/browser/**/*.test.tsx",
      "tests/browser/**/*.spec.tsx",
    ],
    globalSetup: ["./tests/browser/vitest.globalSetup.ts"],
    testTimeout: 30000,
    browser: {
      enabled: true,
      headless: true,
      fileParallelism: false,
      provider: playwright({
        launchOptions: {
          args: ["--disable-dev-shm-usage", "--no-sandbox"],
          env: {
            ...process.env,
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: "1",
          },
        },
      }),
      commands: {
        captureBrowserConsole,
        gotoRoute,
        waitForAppSettled,
        waitForRouteSettled,
        waitForText,
        clickButton,
        clickButtonAndWaitForLoading,
        clickTestId,
        getComputedStyleValue,
        fetchRouteHtmlSummary,
        getLayoutShiftScore,
        resetAppState,
        drainBrowserConsoleErrors,
      },
      instances: browserMatrix,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
