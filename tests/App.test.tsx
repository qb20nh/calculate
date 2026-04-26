import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/index";

const setProgress = (
  progress: Record<"Easy" | "Medium" | "Hard", { current: number; max: number }>,
) => {
  localStorage.setItem("math_scrabble_progress", JSON.stringify(progress));
};

const waitForGameLoaded = async (stageLabel: string) => {
  await vi.advanceTimersByTimeAsync(0);
  await waitFor(() => {
    expect(screen.queryByText("Generating Puzzle...")).toBeNull();
    expect(screen.getAllByText(stageLabel).length).toBeGreaterThan(0);
  });
};

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
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
    vi.doUnmock("@/routes/GameRoute");
    vi.useRealTimers();
  });

  it("should render main menu initially", async () => {
    render(<App />);
    expect(await screen.findByText("Math")).toBeDefined();
  });

  it("should render menu at root even when saved game exists", async () => {
    localStorage.setItem(
      "math_scrabble_state",
      JSON.stringify({
        board: {},
        bank: [],
        initialBankSize: 0,
        status: "playing",
        difficulty: "Hard",
        stage: 3,
      }),
    );

    render(<App />);

    expect(await screen.findByText("Math")).toBeDefined();
    expect(window.location.pathname).toBe("/");
  });

  it("should route to game when starting a level", async () => {
    vi.useRealTimers();
    render(<App />);

    fireEvent.click(await screen.findByText("Easy"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/easy");
      expect(window.location.search).toBe("?stage=1");
    });

    await waitFor(() => {
      expect(screen.queryByText("Generating Puzzle...")).toBeNull();
      expect(screen.getAllByText("Easy — Stage 1").length).toBeGreaterThan(0);
    });
  });

  it("should show a progress bar while a lazy route loads", async () => {
    vi.resetModules();
    vi.doMock(
      "@/routes/GameRoute",
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              default: () => <div>Delayed game route</div>,
            });
          }, 1000);
        }),
    );
    const { App: AppWithDelayedGameRoute } = await import("@/App");

    render(<AppWithDelayedGameRoute />);

    expect(await screen.findByText("Math")).toBeDefined();
    await vi.advanceTimersByTimeAsync(250);
    expect(screen.queryByLabelText("Loading")).toBeNull();

    fireEvent.click(screen.getByText("Easy"));

    expect(screen.getByLabelText("Loading").tagName).toBe("PROGRESS");
    expect(screen.getByLabelText("Loading screen")).toBeDefined();

    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => {
      expect(screen.getByText("Delayed game route")).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading screen")).toBeNull();
    });
  });

  it("should render a direct game stage URL", async () => {
    setProgress({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 3, max: 3 },
    });
    window.history.replaceState(null, "", "/game/hard?stage=3");

    render(<App />);

    await waitForGameLoaded("Hard — Stage 3");
  });

  it("should redirect a difficulty route to saved progress", async () => {
    setProgress({
      Easy: { current: 3, max: 3 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    window.history.replaceState(null, "", "/game/easy");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/easy");
      expect(window.location.search).toBe("?stage=3");
    });
    expect(screen.getAllByText("Easy — Stage 3").length).toBeGreaterThan(0);
  });

  it("should redirect a difficulty route without progress to stage one", async () => {
    window.history.replaceState(null, "", "/game/medium");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/medium");
      expect(window.location.search).toBe("?stage=1");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Medium — Stage 1").length).toBeGreaterThan(0);
    });
  });

  it("should redirect a difficulty route with trailing slash to the canonical path", async () => {
    window.history.replaceState(null, "", "/game/medium/");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/medium");
      expect(window.location.search).toBe("?stage=1");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Medium — Stage 1").length).toBeGreaterThan(0);
    });
  });

  it("should show a locked-level screen without auto redirect", async () => {
    setProgress({
      Easy: { current: 2, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    window.history.replaceState(null, "", "/game/easy?stage=7");

    render(<App />);

    expect(await screen.findByText("Stage 7 locked")).toBeDefined();
    expect(
      screen.getByText("Stage 7 is locked. Latest available is Easy — Stage 2."),
    ).toBeDefined();
    expect(window.location.pathname).toBe("/game/easy");
    expect(window.location.search).toBe("?stage=7");

    fireEvent.click(screen.getByText("Latest available"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/easy");
      expect(window.location.search).toBe("?stage=2");
    });
  });

  it("should navigate back to menu", async () => {
    render(<App />);

    fireEvent.click(await screen.findByText("Easy"));
    await waitForGameLoaded("Easy — Stage 1");

    await waitFor(() => {
      expect(screen.getByLabelText("Back")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Back"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(screen.getByText("Math")).toBeDefined();
  });

  it("should render 404 for invalid game route params", async () => {
    window.history.replaceState(null, "", "/game/unknown?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Page not found")).toBeDefined();
    });
  });

  it("should render 404 for invalid game stage params", async () => {
    window.history.replaceState(null, "", "/game/easy?stage=0");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Page not found")).toBeDefined();
    });
  });
});
