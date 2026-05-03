import { describe, expect, it } from "vitest";
import {
  extractRootCriticalCss,
  optimizeRootInitialLoadPlugin,
} from "../../build/optimizeRootInitialLoadPlugin";

const rootHtml = `
  <html>
    <head>
      <link rel="stylesheet" crossorigin href="/assets/index.css">
      <link rel="modulepreload" crossorigin href="/assets/app-core-test.js">
      <script type="module" crossorigin src="/assets/index.js"></script>
    </head>
    <body>
      <div id="app">
        <main class="theme-page-bg h-dvh w-full p-4 space-y-4 md:p-12 menu-panel-intro">
          <h1 class="text-4xl text-[var(--theme-primary)]">Calculate</h1>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button class="menu-difficulty-card theme-panel border-2 min-w-[120px] whitespace-nowrap active:scale-95">Easy</button>
          </div>
        </main>
      </div>
      <template>
        <div class="tile theme-spinner">1</div>
      </template>
    </body>
  </html>
`;

const loadingRouteHtml = `
  <html>
    <head>
      <link rel="stylesheet" crossorigin href="/assets/index.css">
    </head>
    <body>
      <div id="app">
        <main class="theme-page-bg h-dvh w-full flex flex-col loading-screen loading-screen-fading fixed inset-0 z-[90] items-center justify-center">
          <div id="skeleton-progress" class="route-progress">
            <div class="route-progress-bar"></div>
          </div>
          <div id="skeleton-spinner" class="flex items-center justify-center">
            <div class="size-16 shrink-0 animate-spin rounded-full border-4 theme-spinner"></div>
          </div>
        </main>
      </div>
    </body>
  </html>
`;

const routeHtml = `
  <html>
    <head>
      <link rel="stylesheet" crossorigin href="/assets/index.css">
      <script type="module" crossorigin src="/assets/index.js"></script>
    </head>
    <body>
      <div id="app">
        <main class="theme-page-bg h-dvh w-full flex flex-col">
          <div class="route-only tile">1</div>
        </main>
      </div>
    </body>
  </html>
`;

const rootCss = `
  *, ::before, ::after { box-sizing: border-box; }
  * { --tw-border-style: solid; }
  :root {
    color-scheme: light;
    --theme-bg: #fff;
    --theme-ink: #111;
    --theme-primary: #7c3aed;
    --theme-border: color-mix(in srgb, var(--theme-ink) 12%, var(--theme-bg));
    --theme-number: #22c55e;
    --spacing: .25rem;
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --theme-bg: #020617;
    --theme-ink: #e5e7eb;
    --theme-primary: #a855f7;
    --theme-border: color-mix(in srgb, var(--theme-ink) 16%, var(--theme-bg));
    --theme-number: #4ade80;
  }
  html, body, #app { margin: 0; height: 100dvh; }
  body {
    background: var(--theme-bg);
    color: var(--theme-ink);
    line-height: 1.5;
  }
  button { font: inherit; }
  .theme-page-bg { background: var(--theme-bg); }
  .theme-panel { border: 1px solid var(--theme-border); }
  .text-\\[var\\(--theme-primary\\)\\] { color: var(--theme-primary); }
  .menu-difficulty-card { border-color: var(--theme-border); }
  .menu-difficulty-card:hover { border-color: var(--theme-primary); }
  .grid { display: grid; }
  .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .gap-2\\.5 { gap: calc(var(--spacing) * 2.5); }
  .min-w-\\[120px\\] { min-width: 120px; }
  .whitespace-nowrap { white-space: nowrap; }
  .border-2 { border-style: var(--tw-border-style); border-width: 2px; }
  .p-4 { padding: calc(var(--spacing) * 4); }
  .shrink-0 { flex-shrink: 0; }
  :where(.space-y-4 > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
  .active\\:scale-95:active { transform: scale(.95); }
  .tile { display: flex; }
  .fixed { position: fixed; }
  .inset-0 { inset: 0; }
  .z-\\[90\\] { z-index: 90; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .size-16 { width: 4rem; height: 4rem; }
  .rounded-full { border-radius: 9999px; }
  .border-4 { border-style: var(--tw-border-style); border-width: 4px; }
  .theme-spinner {
    border-color: color-mix(in srgb, var(--theme-primary) 20%, transparent);
    border-top-color: var(--theme-primary);
  }
  .loading-screen {
    opacity: 1;
    pointer-events: auto;
    transition: opacity .24s ease;
  }
  .loading-screen-fading {
    opacity: 0;
    pointer-events: none;
  }
  .menu-panel-intro {
    opacity: .1;
    transform: scale(.9);
  }
  :root[data-app-ready="true"] .menu-panel-intro {
    animation: fadeIn .3s ease-out forwards;
  }
  .animate-spin { animation: spin 1s linear infinite; }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from {
      opacity: .1;
      transform: scale(.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .unused { color: red; }
  @media (min-width: 48rem) {
    .md\\:p-12 { padding: 3rem; }
    .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .unused-at-media { display: block; }
  }
`;

describe("extractRootCriticalCss", () => {
  it("extracts and minifies only root first-paint CSS", () => {
    const criticalCss = extractRootCriticalCss(rootHtml, rootCss);

    expect(criticalCss).toContain("line-height:1.5");
    expect(criticalCss).toContain(".theme-page-bg{background:var(--theme-bg)}");
    expect(criticalCss).toContain(".text-\\[var\\(--theme-primary\\)\\]");
    expect(criticalCss).toContain(".border-2{border-style:solid;border-width:2px}");
    expect(criticalCss).toContain(".p-4{padding:1rem}");
    expect(criticalCss).toContain(".grid{display:grid}");
    expect(criticalCss).toContain(".grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}");
    expect(criticalCss).toContain(".min-w-\\[120px\\]{min-width:120px}");
    expect(criticalCss).toContain(".whitespace-nowrap{white-space:nowrap}");
    expect(criticalCss).toContain("margin-block-start:0;margin-block-end:1rem");
    expect(criticalCss).toContain("@media (min-width:48rem)");
    expect(criticalCss).toContain(".md\\:p-12{padding:3rem}");
    expect(criticalCss).toContain(
      ".sm\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}",
    );
    expect(criticalCss).toContain(".menu-panel-intro{opacity:.1;transform:scale(.9)}");
    expect(criticalCss).toContain(
      ":root[data-app-ready=true] .menu-panel-intro{animation:fadeIn .3s ease-out forwards}",
    );
    expect(criticalCss).toContain("@keyframes fadeIn{from{opacity:.1;transform:scale(.9)}");
    expect(criticalCss).not.toContain(".animate-fade-in");
    expect(criticalCss).not.toContain(".tile");
    expect(criticalCss).not.toContain(".theme-spinner");
    expect(criticalCss).not.toContain(".animate-spin");
    expect(criticalCss).not.toContain(".unused");
    expect(criticalCss).not.toContain(":hover");
    expect(criticalCss).not.toContain("active\\:scale-95");
    expect(criticalCss).not.toContain("--theme-number");
    expect(criticalCss).not.toContain("--tw-border-style");
    expect(criticalCss).not.toContain("--tw-space-y-reverse");
    expect(criticalCss).not.toContain("\n");
  });

  it("keeps loading CSS only for visible loading shells", () => {
    const criticalCss = extractRootCriticalCss(loadingRouteHtml, rootCss);

    expect(criticalCss).toContain(".theme-spinner");
    expect(criticalCss).toContain(".animate-spin");
    expect(criticalCss).toContain(".loading-screen-fading{opacity:0;pointer-events:none}");
    expect(criticalCss).toContain(".fixed{position:fixed}");
    expect(criticalCss).toContain(".shrink-0{flex-shrink:0}");
  });
});

describe("optimizeRootInitialLoadPlugin", () => {
  it("injects generated critical CSS and keeps root load deferrals", () => {
    const plugin = optimizeRootInitialLoadPlugin();
    type TestBundle = Record<string, { type: "asset"; fileName: string; source: string }>;
    const bundle: TestBundle = {
      "index.html": { type: "asset", fileName: "index.html", source: rootHtml },
      "game/easy/index.html": {
        type: "asset",
        fileName: "game/easy/index.html",
        source: routeHtml,
      },
      "assets/index.css": { type: "asset", fileName: "assets/index.css", source: rootCss },
      "assets/GameRoute-test.css": {
        type: "asset",
        fileName: "assets/GameRoute-test.css",
        source: ".route-only{display:grid}",
      },
    };
    const generateBundle = plugin.generateBundle as
      | ((options: unknown, bundle: TestBundle) => void)
      | undefined;

    generateBundle?.({}, bundle);

    const html = bundle["index.html"]?.source ?? "";
    expect(html).toContain("<style data-critical-root>");
    expect(html.indexOf("<style data-critical-root>")).toBeLessThan(
      html.indexOf('rel="stylesheet"'),
    );
    const deferredLink = /<link\b[^>]*data-root-deferred-style[^>]*>/.exec(html)?.[0] ?? "";
    expect(deferredLink).toContain('data-href="/assets/index.css"');
    expect(deferredLink).toContain('media="print"');
    expect(deferredLink).toContain('fetchpriority="low"');
    expect(deferredLink).not.toContain(" href=");
    expect(deferredLink).not.toContain("onload=");
    expect(html).toContain('<noscript><link rel="stylesheet"');
    expect(html).not.toContain('rel="modulepreload"');
    expect(html).not.toContain(
      '<script type="module" crossorigin src="/assets/index.js"></script>',
    );
    expect(html).toContain(
      '<script fetchpriority="low" type="module" crossorigin src="/assets/index.js"></script>',
    );
    const gameHtml = bundle["game/easy/index.html"]?.source ?? "";
    expect(gameHtml).toContain('data-root-deferred-style data-href="/assets/GameRoute-test.css"');
    expect(gameHtml).toContain(
      '<noscript><link rel="stylesheet" crossorigin href="/assets/GameRoute-test.css">',
    );
    expect(gameHtml).toContain("<style data-critical-root>");
    expect(gameHtml).toContain(".route-only{display:grid}");
  });

  it("does not require a split GameRoute stylesheet", () => {
    const plugin = optimizeRootInitialLoadPlugin();
    type TestBundle = Record<string, { type: "asset"; fileName: string; source: string }>;
    const bundle: TestBundle = {
      "index.html": { type: "asset", fileName: "index.html", source: rootHtml },
      "game/easy/index.html": {
        type: "asset",
        fileName: "game/easy/index.html",
        source: rootHtml,
      },
      "assets/index.css": { type: "asset", fileName: "assets/index.css", source: rootCss },
    };
    const generateBundle = plugin.generateBundle as
      | ((options: unknown, bundle: TestBundle) => void)
      | undefined;

    expect(() => generateBundle?.({}, bundle)).not.toThrow();
    expect(bundle["game/easy/index.html"]?.source).not.toContain("GameRoute-");
  });
});
