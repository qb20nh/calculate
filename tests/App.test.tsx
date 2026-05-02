import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/index";
import { OP_PLUS, REL_EQ } from "@/services/math";

const setProgress = (
  progress: Record<"Easy" | "Medium" | "Hard", { current: number; max: number }>,
) => {
  localStorage.setItem("math_scrabble_progress", JSON.stringify(progress));
};

const waitForGameLoaded = async (stageLabel: string) => {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(250);
  await vi.advanceTimersByTimeAsync(0);
  await waitFor(() => {
    expect(screen.queryByText("Generating Puzzle...")).toBeNull();
    expect(screen.getAllByText(stageLabel).length).toBeGreaterThan(0);
  });
};

const requireValue = <T,>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("Expected value");
  }
  return value;
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

  it("should render in Korean when saved preferences exist", async () => {
    localStorage.setItem("math_scrabble_prefs", JSON.stringify({ theme: "dark", locale: "ko" }));

    render(<App />);

    expect(await screen.findByText("수학")).toBeDefined();
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.lang).toBe("ko");
    });
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
      expect(screen.getAllByText("Easy - Stage 1").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.queryByText("Generating Puzzle...")).toBeNull();
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

    expect(screen.getByLabelText("Loading").tagName).toBe("DIV");
    expect(screen.getByLabelText("Loading screen")).toBeDefined();

    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => {
      expect(screen.getByText("Delayed game route")).toBeDefined();
    });
    await vi.advanceTimersByTimeAsync(360);
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading screen")).toBeNull();
    });
  });

  it("should render a direct game stage URL", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 3, max: 3 },
    });
    window.history.replaceState(null, "", "/game/hard?stage=3");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Hard - Stage 3").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.queryByText("Generating Puzzle...")).toBeNull();
      expect(screen.queryByLabelText("Loading screen")).toBeNull();
    });
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
    expect(screen.getAllByText("Easy - Stage 3").length).toBeGreaterThan(0);
  });

  it("should redirect a difficulty route without progress to stage one", async () => {
    window.history.replaceState(null, "", "/game/medium");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/medium");
      expect(window.location.search).toBe("?stage=1");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Medium - Stage 1").length).toBeGreaterThan(0);
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
      expect(screen.getAllByText("Medium - Stage 1").length).toBeGreaterThan(0);
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
      screen.getByText(
        "This level is not unlocked yet. Use the buttons below to leave or continue.",
      ),
    ).toBeDefined();
    expect(screen.getByText("Go to stage 2")).toBeDefined();
    expect(window.location.pathname).toBe("/game/easy");
    expect(window.location.search).toBe("?stage=7");

    fireEvent.click(screen.getByText("Go to stage 2"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/easy");
      expect(window.location.search).toBe("?stage=2");
    });
  });

  it("should navigate back to menu", async () => {
    render(<App />);

    fireEvent.click(await screen.findByText("Easy"));
    await waitForGameLoaded("Easy - Stage 1");
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByLabelText("Back")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Back"));
    await waitFor(() => {
      expect(screen.getByLabelText("Loading")).toBeDefined();
      expect(screen.getByLabelText("Loading screen")).toBeDefined();
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(screen.getByText("Math")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading screen")).toBeNull();
    });
  });

  it("should restore an in-progress save on direct stage refresh", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 1, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    localStorage.setItem(
      "math_scrabble_state",
      JSON.stringify({
        board: {
          "0,0": { id: "saved-given", val: "9", type: "val", isGiven: true },
        },
        bank: [],
        initialBankSize: 0,
        status: "playing",
        difficulty: "Easy",
        stage: 1,
        solvedAcknowledged: false,
      }),
    );
    window.history.replaceState(null, "", "/game/easy?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 1").length).toBeGreaterThan(0);
      expect(screen.getByText("Bank is empty.")).toBeDefined();
    });
  });

  it("should keep an in-progress save when navigating to another stage", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 1, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    window.history.replaceState(null, "", "/game/easy?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 1").length).toBeGreaterThan(0);
    });

    let bankTile: HTMLElement | undefined;
    await waitFor(() => {
      bankTile = screen
        .getAllByRole("button")
        .find((button) => button.className.includes("tile") && button.className.includes("w-11"));
      expect(bankTile).toBeDefined();
    });
    bankTile = requireValue(bankTile);
    fireEvent.click(bankTile);
    fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("math_scrabble_state") || "{}")).toMatchObject({
        difficulty: "Easy",
        stage: 1,
        status: "playing",
      });
    });

    fireEvent.click(requireValue(screen.getAllByLabelText("Next Stage")[0]));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/game/easy");
      expect(window.location.search).toBe("?stage=2");
    });
    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 2").length).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(JSON.parse(localStorage.getItem("math_scrabble_state") || "{}")).toMatchObject({
      difficulty: "Easy",
      stage: 1,
      status: "playing",
    });
  });

  it("should keep an in-progress save when viewing a saved cleared stage", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 1, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    const activeState = {
      board: {
        "0,0": { id: "active-given", val: "9", type: "val", isGiven: true },
      },
      bank: [{ id: "active-bank", val: OP_PLUS, type: "op" }],
      initialBankSize: 1,
      status: "playing",
      difficulty: "Easy",
      stage: 2,
      solvedAcknowledged: false,
    };
    const clearedState = {
      board: {
        "0,0": { id: "cleared-left", val: "1", type: "val", isGiven: true },
        "0,1": { id: "cleared-eq", val: REL_EQ, type: "rel", isGiven: true },
        "0,2": { id: "cleared-right", val: "1", type: "val", isGiven: true },
      },
      bank: [],
      initialBankSize: 0,
      status: "won",
      difficulty: "Easy",
      stage: 1,
      solvedAcknowledged: true,
    };
    localStorage.setItem("math_scrabble_state", JSON.stringify(activeState));
    localStorage.setItem(
      "math_scrabble_cleared_states",
      JSON.stringify({ "Easy:1": clearedState }),
    );
    window.history.replaceState(null, "", "/game/easy?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 1").length).toBeGreaterThan(0);
      expect(screen.getByText("Bank is empty.")).toBeDefined();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(JSON.parse(localStorage.getItem("math_scrabble_state") || "{}")).toMatchObject({
      difficulty: "Easy",
      stage: 2,
      status: "playing",
    });
  });

  it("should clear a saved cleared stage only after placing a tile after reset", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 1, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    const activeState = {
      board: {
        "0,0": { id: "active-given", val: "9", type: "val", isGiven: true },
      },
      bank: [{ id: "active-bank", val: OP_PLUS, type: "op" }],
      initialBankSize: 1,
      status: "playing",
      difficulty: "Easy",
      stage: 2,
      solvedAcknowledged: false,
    };
    const clearedState = {
      board: {
        "0,0": { id: "cleared-left", val: "1", type: "val", isGiven: true },
        "0,1": { id: "cleared-eq", val: REL_EQ, type: "rel", isGiven: true },
        "0,2": { id: "cleared-right", val: "1", type: "val", isGiven: true },
      },
      bank: [],
      initialBankSize: 0,
      status: "won",
      difficulty: "Easy",
      stage: 1,
      solvedAcknowledged: true,
    };
    localStorage.setItem("math_scrabble_state", JSON.stringify(activeState));
    localStorage.setItem(
      "math_scrabble_cleared_states",
      JSON.stringify({ "Easy:1": clearedState }),
    );
    window.history.replaceState(null, "", "/game/easy?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Bank is empty.")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Reset Stage"));
    fireEvent.click(screen.getByText("Reset"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(JSON.parse(localStorage.getItem("math_scrabble_cleared_states") || "{}")).toHaveProperty(
      "Easy:1",
    );
    expect(JSON.parse(localStorage.getItem("math_scrabble_state") || "{}")).toMatchObject({
      difficulty: "Easy",
      stage: 2,
      status: "playing",
    });

    let bankTile: HTMLElement | undefined;
    await waitFor(() => {
      bankTile = screen
        .getAllByRole("button")
        .find((button) => button.className.includes("tile") && button.className.includes("w-11"));
      expect(bankTile).toBeDefined();
    });
    fireEvent.click(requireValue(bankTile));
    fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("math_scrabble_state") || "{}")).toMatchObject({
        difficulty: "Easy",
        stage: 1,
        status: "playing",
      });
    });
    expect(
      JSON.parse(localStorage.getItem("math_scrabble_cleared_states") || "{}"),
    ).not.toHaveProperty("Easy:1");
  });

  it("should restore an in-session stage save after visiting a cleared earlier stage", async () => {
    vi.useRealTimers();
    setProgress({
      Easy: { current: 2, max: 2 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    localStorage.setItem(
      "math_scrabble_cleared_states",
      JSON.stringify({
        "Easy:1": {
          board: {
            "0,0": { id: "cleared-left", val: "1", type: "val", isGiven: true },
            "0,1": { id: "cleared-eq", val: REL_EQ, type: "rel", isGiven: true },
            "0,2": { id: "cleared-right", val: "1", type: "val", isGiven: true },
          },
          bank: [],
          initialBankSize: 0,
          status: "won",
          difficulty: "Easy",
          stage: 1,
          solvedAcknowledged: true,
        },
      }),
    );
    window.history.replaceState(null, "", "/game/easy?stage=2");

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 2").length).toBeGreaterThan(0);
    });

    let bankTile: HTMLElement | undefined;
    await waitFor(() => {
      bankTile = screen
        .getAllByRole("button")
        .find((button) => button.className.includes("tile") && button.className.includes("w-11"));
      expect(bankTile).toBeDefined();
    });
    fireEvent.click(requireValue(bankTile));
    fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));

    let placedTile: { val: string; type: string } | undefined;
    await waitFor(() => {
      const savedState = JSON.parse(localStorage.getItem("math_scrabble_state") || "{}");
      expect(savedState).toMatchObject({ difficulty: "Easy", stage: 2, status: "playing" });
      placedTile = Object.values(savedState.board as Record<string, { isGiven?: boolean }>).find(
        (tile) => tile.isGiven === false,
      ) as { val: string; type: string } | undefined;
      expect(placedTile).toBeDefined();
    });

    fireEvent.click(requireValue(screen.getAllByLabelText("Previous Stage")[0]));
    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 1").length).toBeGreaterThan(0);
      expect(screen.getByText("Bank is empty.")).toBeDefined();
    });

    fireEvent.click(requireValue(screen.getAllByLabelText("Next Stage")[0]));
    await waitFor(() => {
      expect(screen.getAllByText("Easy - Stage 2").length).toBeGreaterThan(0);
    });

    const restoredPlacedTiles = Array.from(
      document.querySelectorAll(`.tile-${requireValue(placedTile).type}:not(.tile-given)`),
    );
    expect(restoredPlacedTiles.some((tile) => tile.textContent === placedTile?.val)).toBe(true);
  });

  it("should render 404 for invalid game route params", async () => {
    window.history.replaceState(null, "", "/game/unknown?stage=1");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Page not found")).toBeDefined();
    });
  });

  it("should render custom game setup", async () => {
    window.history.replaceState(null, "", "/game/custom");

    render(<App />);

    expect(await screen.findByText("Custom Game")).toBeDefined();
  });

  it("should render 404 for a game route without difficulty", async () => {
    window.history.replaceState(null, "", "/game");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Page not found")).toBeDefined();
    });
  });

  it("should render 404 for a game route without difficulty and trailing slash", async () => {
    window.history.replaceState(null, "", "/game/");

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
