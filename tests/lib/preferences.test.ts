import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  resolveTheme,
  saveAppPreferences,
  syncDocumentPreferences,
} from "@/services/preferences";

describe("preferences", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key in storage) delete storage[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should fall back to default preferences", () => {
    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("should fall back to defaults when localStorage is unavailable", () => {
    const originalLocalStorage = global.localStorage;
    // @ts-expect-error intentional storage absence
    delete global.localStorage;

    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);

    global.localStorage = originalLocalStorage;
  });

  it("should read and write preferences", () => {
    saveAppPreferences({ theme: "dark", locale: "ko" });
    expect(loadAppPreferences()).toEqual({ theme: "dark", locale: "ko" });
  });

  it("should fall back to defaults for malformed stored preferences", () => {
    localStorage.setItem("math_scrabble_prefs", "{not-json");
    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);

    localStorage.setItem("math_scrabble_prefs", JSON.stringify({ theme: "neon", locale: "fr" }));
    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("should no-op save when storage is unavailable", () => {
    const originalLocalStorage = global.localStorage;
    // @ts-expect-error intentional storage absence
    delete global.localStorage;

    expect(() => saveAppPreferences({ theme: "dark", locale: "ko" })).not.toThrow();

    global.localStorage = originalLocalStorage;
  });

  it("should resolve system theme", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("should resolve system theme without matchMedia", () => {
    const originalMatchMedia = window.matchMedia;
    // @ts-expect-error intentional browser API absence
    delete window.matchMedia;

    expect(loadAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(() => loadAppPreferences()).not.toThrow();

    window.matchMedia = originalMatchMedia;
  });

  it("should sync document preferences", () => {
    syncDocumentPreferences({ theme: "dark", locale: "ko" }, "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.lang).toBe("ko");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("should no-op sync without document", () => {
    const originalDocument = global.document;
    // @ts-expect-error intentional SSR-style absence
    delete global.document;

    expect(() => syncDocumentPreferences({ theme: "dark", locale: "ko" }, "dark")).not.toThrow();

    global.document = originalDocument;
  });
});
