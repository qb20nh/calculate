import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyDeferredStylesheets,
  ensureDeferredStylesheets,
  scheduleDeferredStylesheets,
} from "@/lib/deferredStylesheet";

describe("applyDeferredStylesheets", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
  });

  it("should promote deferred root stylesheets", () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" href="/assets/app.css" media="print" fetchpriority="low">
      <link data-root-deferred-style rel="stylesheet" href="/assets/applied.css" media="all" fetchpriority="low">
      <link rel="stylesheet" href="/assets/other.css" media="print" fetchpriority="low">
    `;

    applyDeferredStylesheets();

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    const otherStylesheet = document.querySelector<HTMLLinkElement>(
      'link[href="/assets/other.css"]',
    );
    const appliedStylesheet = document.querySelector<HTMLLinkElement>(
      'link[href="/assets/applied.css"]',
    );

    expect(rootStylesheet?.media).toBe("all");
    expect(rootStylesheet?.getAttribute("fetchpriority")).toBe("high");
    expect(appliedStylesheet?.getAttribute("fetchpriority")).toBe("low");
    expect(otherStylesheet?.media).toBe("print");
    expect(otherStylesheet?.getAttribute("fetchpriority")).toBe("low");
  });

  it("should materialize data-href deferred root stylesheets", () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" data-href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");

    expect(rootStylesheet.getAttribute("href")).toBeNull();

    applyDeferredStylesheets();

    expect(rootStylesheet.getAttribute("href")).toBe("/assets/app.css");
    expect(rootStylesheet.media).toBe("all");
    expect(rootStylesheet.getAttribute("fetchpriority")).toBe("high");
  });

  it("should no-op without deferred root stylesheets", () => {
    document.head.innerHTML = '<link rel="stylesheet" href="/assets/other.css">';

    expect(ensureDeferredStylesheets()).toBeUndefined();
  });

  it("should resolve after deferred root stylesheets load", async () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");

    let resolved = false;
    const ensurePromise = ensureDeferredStylesheets();
    if (!ensurePromise) throw new Error("Expected deferred stylesheet promise");

    const loadPromise = ensurePromise.then(() => {
      resolved = true;
    });

    await Promise.resolve();

    expect(rootStylesheet.media).toBe("all");
    expect(rootStylesheet.getAttribute("fetchpriority")).toBe("high");
    expect(resolved).toBe(false);

    rootStylesheet.dispatchEvent(new Event("load"));
    await loadPromise;

    expect(resolved).toBe(true);
  });

  it("should schedule deferred stylesheet materialization after idle", async () => {
    vi.useFakeTimers();
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" data-href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");

    scheduleDeferredStylesheets();
    expect(rootStylesheet.getAttribute("href")).toBeNull();

    await vi.runOnlyPendingTimersAsync();

    expect(rootStylesheet.getAttribute("href")).toBe("/assets/app.css");
    expect(rootStylesheet.media).toBe("all");
  });

  it("should use requestIdleCallback for deferred stylesheet scheduling when available", () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" data-href="/assets/app.css" media="print" fetchpriority="low">
    `;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 0 });
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);

    scheduleDeferredStylesheets();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    expect(
      document
        .querySelector<HTMLLinkElement>("link[data-root-deferred-style]")
        ?.getAttribute("href"),
    ).toBe("/assets/app.css");
  });

  it("should resolve data-href deferred stylesheets after load", async () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" data-href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");

    const ensurePromise = ensureDeferredStylesheets();
    if (!ensurePromise) throw new Error("Expected deferred stylesheet promise");

    expect(rootStylesheet.getAttribute("href")).toBe("/assets/app.css");
    rootStylesheet.dispatchEvent(new Event("load"));

    await ensurePromise;
    expect(rootStylesheet.media).toBe("all");
  });

  it("should reuse pending deferred stylesheet loads", async () => {
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");

    const firstPromise = ensureDeferredStylesheets();
    const secondPromise = ensureDeferredStylesheets();
    if (!firstPromise || !secondPromise) throw new Error("Expected deferred stylesheet promises");

    rootStylesheet.dispatchEvent(new Event("load"));

    await Promise.all([firstPromise, secondPromise]);
    expect(rootStylesheet.media).toBe("all");
  });

  it("should resolve loaded deferred stylesheets on the next task", async () => {
    vi.useFakeTimers();
    document.head.innerHTML = `
      <link data-root-deferred-style rel="stylesheet" href="/assets/app.css" media="print" fetchpriority="low">
    `;

    const rootStylesheet = document.querySelector<HTMLLinkElement>(
      "link[data-root-deferred-style]",
    );
    if (!rootStylesheet) throw new Error("Missing deferred stylesheet");
    Object.defineProperty(rootStylesheet, "sheet", { value: {}, configurable: true });

    const loadPromise = ensureDeferredStylesheets();
    if (!loadPromise) throw new Error("Expected deferred stylesheet promise");

    await vi.runOnlyPendingTimersAsync();
    await loadPromise;

    expect(rootStylesheet.media).toBe("all");
  });

  it("should no-op when document is unavailable", () => {
    vi.stubGlobal("document", undefined);

    expect(applyDeferredStylesheets()).toBeUndefined();
    expect(ensureDeferredStylesheets()).toBeUndefined();
  });
});
