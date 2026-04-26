import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { playwright } from "@vitest/browser-playwright";
import type { Page } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

const browserConsoleState = new Map<
  string,
  {
    errors: string[];
    appPage?: Page;
  }
>();

const isKnownHydrationMismatch = (text: string) =>
  text.includes("Expected a DOM node of type") &&
  text.includes(
    "this is caused by the SSR'd HTML containing different DOM-nodes compared to the hydrated one.",
  );

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
      process.stderr.write(`[browser warn] ${prefix ? `${prefix} ` : ""}${text}\n`);
    }
    if (message.type() === "error" && !isKnownHydrationMismatch(text)) {
      state.errors.push(text);
      process.stderr.write(`[browser error] ${prefix ? `${prefix} ` : ""}${text}\n`);
    }
  });

  appPage.on("pageerror", (error) => {
    const text = error.stack || error.message;
    if (isKnownHydrationMismatch(text)) return;
    state.errors.push(text);
    process.stderr.write(`[page error] ${text}\n`);
  });

  return appPage;
};

const captureBrowserConsole: BrowserCommand = async (context) => {
  const { sessionId } = context;
  if (browserConsoleState.has(sessionId)) return;

  browserConsoleState.set(sessionId, {
    errors: [] as string[],
  });

  await ensureAppPage(context);
};

const gotoRoute: BrowserCommand<[string]> = async (context, path) => {
  const previewBaseUrl = process.env.VITEST_PREVIEW_URL;
  if (!previewBaseUrl) throw new Error("Missing VITEST_PREVIEW_URL");
  const page = await ensureAppPage(context);
  await page.goto(`${previewBaseUrl}${path}`, { waitUntil: "domcontentloaded" });
};

const waitForText: BrowserCommand<[string]> = async (context, text) => {
  const page = await ensureAppPage(context);
  await page.waitForFunction(
    (expectedText) => document.body.textContent?.includes(expectedText),
    text,
  );
};

const clickButton: BrowserCommand<[string]> = async (context, name) => {
  const page = await ensureAppPage(context);
  await page.getByRole("button", { name }).click();
};

const drainBrowserConsoleErrors: BrowserCommand = ({ sessionId }) => {
  const state = browserConsoleState.get(sessionId);
  if (!state) return [];

  const errors = state.errors.slice();
  state.errors.length = 0;
  return errors;
};

export default defineConfig({
  plugins: [preact()],
  test: {
    globalSetup: ["./tests/browser/vitest.globalSetup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          args: ["--disable-dev-shm-usage", "--no-sandbox"],
        },
      }),
      commands: {
        captureBrowserConsole,
        gotoRoute,
        waitForText,
        clickButton,
        drainBrowserConsoleErrors,
      },
      instances: [{ browser: "chromium", name: "chromium" }],
    },
    include: ["tests/browser/**/*.browser.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
