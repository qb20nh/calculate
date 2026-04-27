import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider, useAppSettings } from "@/lib/appSettings";

function TestProbe() {
  const {
    copy,
    preferences,
    resolvedTheme,
    setThemePreference,
    setLocale,
    cycleThemePreference,
    toggleLocale,
    t,
  } = useAppSettings();

  return (
    <div>
      <span data-testid="title">{copy.appTitle}</span>
      <span data-testid="menu">{copy.menuTitleMain}</span>
      <span data-testid="difficulty">{copy.difficulty.Custom}</span>
      <span data-testid="stage">
        {t("game.stageLabel", { difficulty: copy.difficulty.Easy, stage: 3 })}
      </span>
      <span data-testid="validation">{copy.custom.validation.totalTiles}</span>
      <span data-testid="theme-label">{copy.themePreference.dark}</span>
      <span data-testid="locale-label">{copy.localeLabel.ko}</span>
      <span data-testid="locked">{t("game.stageLockedTitle", { stage: 7 })}</span>
      <span data-testid="goto">{t("game.goToStage", { stage: 2 })}</span>
      <span data-testid="loading-text">{copy.game.generatingPuzzle}</span>
      <span data-testid="bank-empty">{copy.game.bankEmpty}</span>
      <span data-testid="reset-title">{copy.game.resetDialogTitle}</span>
      <span data-testid="reset-desc">{copy.game.resetDialogDescription}</span>
      <span data-testid="success">{copy.game.successLabel}</span>
      <span data-testid="perfect">{copy.game.perfect}</span>
      <span data-testid="cleared">{copy.game.clearedBoard}</span>
      <span data-testid="dismiss">{copy.game.dismiss}</span>
      <span data-testid="next-level">{copy.game.nextLevel}</span>
      <span data-testid="too-large">{copy.game.solutionTooLarge}</span>
      <span data-testid="vr1">{copy.game.validation.boardEmpty}</span>
      <span data-testid="vr2">{copy.game.validation.noFormula}</span>
      <span data-testid="vr3">{copy.game.validation.noCrossing}</span>
      <span data-testid="vr4">{t("game.validation.invalidFormula", { formula: "1+1=3" })}</span>
      <span data-testid="custom-title">{copy.custom.title}</span>
      <span data-testid="custom-start">{copy.custom.start}</span>
      <span data-testid="custom-loading">{copy.custom.loadingTitle}</span>
      <span data-testid="custom-retry">
        {t("custom.retryLabel", { retryCount: 1, totalRetries: 2 })}
      </span>
      <span data-testid="custom-hint">{copy.custom.loadingHint}</span>
      <span data-testid="custom-cancel">{copy.custom.cancel}</span>
      <span data-testid="custom-invalid">{copy.custom.invalidUrl}</span>
      <span data-testid="custom-error">{copy.custom.generationError}</span>
      <span data-testid="custom-regen">{copy.custom.couldNotRegenerate}</span>
      <span data-testid="notfound">{copy.notFound.title}</span>
      <span data-testid="aria-loading">{copy.aria.loading}</span>
      <span data-testid="theme">{resolvedTheme}</span>
      <span data-testid="locale">{preferences.locale}</span>
      <button type="button" onClick={() => setThemePreference("dark")}>
        Set Dark
      </button>
      <button type="button" onClick={cycleThemePreference}>
        Cycle Theme
      </button>
      <button type="button" onClick={() => setLocale("ko")}>
        Set Korean
      </button>
      <button type="button" onClick={toggleLocale}>
        Toggle Locale
      </button>
    </div>
  );
}

function renderWithProvider(children: ComponentChildren) {
  return render(<AppSettingsProvider>{children}</AppSettingsProvider>);
}

type MediaQueryChangeHandler = (this: MediaQueryList, event: MediaQueryListEvent) => void;

const createMediaQueryList = (matches: boolean, modern = false) => {
  let listener: MediaQueryChangeHandler | null = null;

  const addEventListener = vi.fn(
    (type: string, nextListener: EventListenerOrEventListenerObject) => {
      if (type !== "change" || typeof nextListener !== "function") {
        return;
      }

      listener = nextListener as MediaQueryChangeHandler;
    },
  );
  const removeEventListener = vi.fn();
  const addListener = vi.fn((nextListener: MediaQueryChangeHandler) => {
    listener = nextListener;
  });
  const removeListener = vi.fn();
  const dispatchEvent = vi.fn(() => true);

  const media = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: modern ? addEventListener : undefined,
    removeEventListener: modern ? removeEventListener : undefined,
    addListener: modern ? undefined : addListener,
    removeListener: modern ? undefined : removeListener,
    dispatchEvent,
  } as unknown as MediaQueryList;

  return {
    media,
    addEventListener,
    removeEventListener,
    addListener,
    removeListener,
    fireChange(nextMatches: boolean) {
      listener?.call(media, { matches: nextMatches } as MediaQueryListEvent);
    },
  };
};

describe("AppSettingsProvider", () => {
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

  it("should expose English copy by default and persist toggles", async () => {
    renderWithProvider(<TestProbe />);

    expect(screen.getByTestId("title").textContent).toBe("Math Crossword");
    expect(screen.getByTestId("menu").textContent).toBe("Math");
    expect(screen.getByTestId("difficulty").textContent).toBe("Custom");
    expect(screen.getByTestId("stage").textContent).toBe("Easy — Stage 3");
    expect(screen.getByTestId("validation").textContent).toBe("Need at least 9 total tiles.");

    fireEvent.click(screen.getByText("Set Korean"));
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ko");
      expect(screen.getByTestId("title").textContent).toBe("수학 크로스워드");
      expect(screen.getByTestId("stage").textContent).toBe("쉬움 — 3단계");
    });

    fireEvent.click(screen.getByText("Toggle Locale"));
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(screen.getByTestId("title").textContent).toBe("Math Crossword");
      expect(screen.getByTestId("stage").textContent).toBe("Easy — Stage 3");
    });

    fireEvent.click(screen.getByText("Set Dark"));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    fireEvent.click(screen.getByText("Cycle Theme"));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(JSON.parse(localStorage.getItem("math_scrabble_prefs") || "{}")).toMatchObject({
        theme: "system",
        locale: "en",
      });
    });
  });

  it("should honor saved preferences and system dark mode", async () => {
    localStorage.setItem("math_scrabble_prefs", JSON.stringify({ theme: "system", locale: "ko" }));
    const originalMatchMedia = window.matchMedia;
    const { media, fireChange } = createMediaQueryList(true);
    window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia;

    const { unmount } = renderWithProvider(<TestProbe />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.lang).toBe("ko");
      expect(screen.getByTestId("title").textContent).toBe("수학 크로스워드");
      expect(screen.getByTestId("locale").textContent).toBe("ko");
    });

    fireChange(false);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    unmount();
    window.matchMedia = originalMatchMedia;
  });

  it("should register and clean up an addEventListener matchMedia handler", async () => {
    const originalMatchMedia = window.matchMedia;
    const { media, addEventListener, removeEventListener, fireChange } = createMediaQueryList(
      false,
      true,
    );
    window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia;

    const { unmount } = renderWithProvider(<TestProbe />);

    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    fireChange(true);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    window.matchMedia = originalMatchMedia;
  });
});
