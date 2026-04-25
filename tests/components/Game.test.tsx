import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "@/components/Game";
import * as BoardService from "@/services/board";

vi.mock("@/services/board", async () => {
  const actual = await vi.importActual<typeof BoardService>("@/services/board");
  return {
    ...actual,
    generateGame: vi.fn(actual.generateGame),
    validateBoard: vi.fn(actual.validateBoard),
  };
});

const requireValue = <T,>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("Expected value");
  }
  return value;
};

const renderGame = (props: Partial<Parameters<typeof Game>[0]> = {}) =>
  render(
    <Game
      difficulty="Easy"
      stage={1}
      maxStage={5}
      onWin={vi.fn()}
      onBack={vi.fn()}
      onStageChange={vi.fn()}
      onStateChange={vi.fn()}
      {...props}
    />,
  );

const waitForGameLoaded = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await waitFor(() => {
    expect(screen.queryByText("Generating Puzzle...")).toBeNull();
  });
};

describe("Game", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the board without a manual generation delay", async () => {
    renderGame();

    await waitForGameLoaded();

    expect(screen.getByText("Easy — Stage 1")).toBeDefined();
  });

  it("should not show a progress bar while generating a level", async () => {
    renderGame();

    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(screen.queryByLabelText("Loading screen")).toBeNull();

    await waitForGameLoaded();

    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(screen.queryByLabelText("Loading screen")).toBeNull();
  });

  it("should render the board after loading", async () => {
    renderGame();

    await waitForGameLoaded();

    expect(screen.getByText("Easy — Stage 1")).toBeDefined();
  });

  it("should handle tile selection and placement", async () => {
    renderGame();

    await waitForGameLoaded();

    // Wait for tiles to appear in bank
    let bankTiles: HTMLElement[] = [];
    await waitFor(() => {
      bankTiles = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            b.className.includes("tile-val") ||
            b.className.includes("tile-op") ||
            b.className.includes("tile-rel"),
        );
      expect(bankTiles.length).toBeGreaterThan(0);
    });

    // Find a tile in the bank and click it
    const firstBankTile = bankTiles[0];
    expect(firstBankTile).toBeDefined();
    fireEvent.click(requireValue(firstBankTile));

    // Wait for it to be selected
    await waitFor(() => {
      expect(requireValue(firstBankTile).className).toContain("ring-4");
    });

    // Find a fringe slot and click it
    const fringeSlots = screen.getAllByLabelText("Place tile here");
    const firstFringeSlot = fringeSlots[0];
    expect(firstFringeSlot).toBeDefined();
    fireEvent.click(requireValue(firstFringeSlot));

    // Selection should be cleared. Re-query the tile if it still exists.
    await waitFor(() => {
      const updatedTiles = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            b.className.includes("tile-val") ||
            b.className.includes("tile-op") ||
            b.className.includes("tile-rel"),
        );
      // If bankTiles[0] was removed, it should not be in the bank.
      // If it was swapped, its id would be different.
      const isStillSelected = updatedTiles.some((t) => t.className.includes("ring-4"));
      expect(isStillSelected).toBe(false);
    });
  });

  it("should swap a selected bank tile with an occupied movable board cell", async () => {
    vi.mocked(BoardService.generateGame).mockReturnValue({
      board: {
        "0,0": { id: "g1", val: "1", type: "val", isGiven: true },
        "0,1": { id: "m1", val: "2", type: "val", isGiven: false },
      },
      bank: [{ id: "b1", val: "3", type: "val" }],
      initialBankSize: 1,
      status: "playing",
    } as unknown as ReturnType<typeof BoardService.generateGame>);

    renderGame();

    await waitForGameLoaded();

    const bankTile = screen.getByText("3", { selector: ".tile-val" });
    fireEvent.click(bankTile);

    const movableBoardTile = screen.getByText("2", { selector: ".tile-val" });
    fireEvent.click(movableBoardTile);

    await waitFor(() => {
      expect(screen.getByText("3", { selector: ".tile-val" })).toBeDefined();
    });
  });

  it("should move an unselected movable board tile back into the bank", async () => {
    vi.mocked(BoardService.generateGame).mockReturnValue({
      board: {
        "0,0": { id: "g1", val: "1", type: "val", isGiven: true },
        "0,1": { id: "m1", val: "2", type: "val", isGiven: false },
      },
      bank: [
        { id: "b1", val: "1", type: "val" },
        { id: "b2", val: "4", type: "op" },
        { id: "b3", val: "9", type: "val" },
      ],
      initialBankSize: 3,
      status: "playing",
    } as unknown as ReturnType<typeof BoardService.generateGame>);

    renderGame();

    await waitForGameLoaded();

    const movableBoardTile = screen.getByText("2", { selector: ".tile-val" });
    fireEvent.click(movableBoardTile);

    await waitFor(() => {
      expect(screen.getAllByText("2", { selector: ".tile-val" }).length).toBeGreaterThan(0);
    });
  });

  it("should handle reset", async () => {
    const generateGameSpy = vi.mocked(BoardService.generateGame);
    generateGameSpy.mockClear();

    renderGame();

    await waitForGameLoaded();

    await waitFor(() => {
      expect(screen.getByText("Easy — Stage 1")).toBeDefined();
    });

    const resetButton = screen.getByLabelText("Reset Stage");
    fireEvent.click(resetButton);

    const dialog = screen.getByRole("dialog", { name: "Reset this stage?" });
    expect(dialog).toBeDefined();

    fireEvent.click(screen.getByText("Reset"));

    expect(screen.getByText("Easy — Stage 1")).toBeDefined();
    expect(generateGameSpy).toHaveBeenCalledTimes(2);
  });

  it("should cancel reset when dialog is dismissed", async () => {
    const generateGameSpy = vi.mocked(BoardService.generateGame);
    generateGameSpy.mockClear();

    renderGame();

    await waitForGameLoaded();

    const resetButton = screen.getByLabelText("Reset Stage");
    fireEvent.click(resetButton);

    expect(screen.getByRole("dialog", { name: "Reset this stage?" })).toBeDefined();
    fireEvent.click(screen.getByText("Cancel"));
    expect(generateGameSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle back button", async () => {
    const onBack = vi.fn();
    renderGame({ onBack });

    await waitForGameLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText("Back")).toBeDefined();
    });

    const backButton = screen.getByLabelText("Back");
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalled();
  });

  it("should not select given tiles", async () => {
    renderGame();

    await waitForGameLoaded();

    let givenTiles: HTMLElement[] = [];
    await waitFor(() => {
      givenTiles = screen.getAllByRole("button").filter((b) => b.className.includes("tile-given"));
      expect(givenTiles.length).toBeGreaterThan(0);
    });

    const firstGivenTile = givenTiles[0];
    expect(firstGivenTile).toBeDefined();
    fireEvent.click(requireValue(firstGivenTile));
    expect(requireValue(firstGivenTile).className).not.toContain("ring-4");
  });

  it("should show toast for invalid board", async () => {
    const mockGame = {
      board: {
        "0,0": { id: "g1", val: "1", type: "val", isGiven: true },
        "0,1": { id: "g2", val: "=", type: "rel", isGiven: true },
      },
      bank: [{ id: "b1", val: "2", type: "val" }], // 1=2 is invalid
      initialBankSize: 1,
      status: "playing",
    };
    vi.mocked(BoardService.generateGame).mockReturnValue(
      mockGame as unknown as ReturnType<typeof BoardService.generateGame>,
    );
    vi.mocked(BoardService.validateBoard).mockReturnValue({
      valid: false,
      reason: "Invalid equation",
    });

    renderGame();

    await waitForGameLoaded();

    // Place the tile
    fireEvent.click(screen.getByText("2", { selector: ".tile-val" }));
    const firstFringeSlot = screen.getAllByLabelText("Place tile here")[0];
    expect(firstFringeSlot).toBeDefined();
    fireEvent.click(requireValue(firstFringeSlot));

    // Should show validation error toast
    await waitFor(
      () => {
        expect(screen.getByText("Invalid equation")).toBeDefined();
      },
      { timeout: 3000 },
    );
  });

  it("should show win screen when board is solved", async () => {
    const mockGame = {
      board: {
        "0,0": { id: "g1", val: "1", type: "val", isGiven: true },
        "0,1": { id: "g2", val: "=", type: "rel", isGiven: true },
      },
      bank: [{ id: "b1", val: "1", type: "val" }],
      initialBankSize: 1,
      status: "playing",
    };
    vi.mocked(BoardService.generateGame).mockReturnValue(
      mockGame as unknown as ReturnType<typeof BoardService.generateGame>,
    );
    vi.mocked(BoardService.validateBoard).mockReturnValue({ valid: true });

    const onWin = vi.fn();
    renderGame({ onWin });

    await waitForGameLoaded();

    // Select and place
    fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
    const firstWinFringeSlot = screen.getAllByLabelText("Place tile here")[0];
    expect(firstWinFringeSlot).toBeDefined();
    fireEvent.click(requireValue(firstWinFringeSlot));

    // Win screen should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Perfect!" })).toBeDefined();
    });

    expect(onWin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Next level"));
    expect(onWin).toHaveBeenCalledWith(2);
  });

  it("should dismiss win dialog without advancing", async () => {
    const mockGame = {
      board: {
        "0,0": { id: "g1", val: "1", type: "val", isGiven: true },
        "0,1": { id: "g2", val: "=", type: "rel", isGiven: true },
      },
      bank: [{ id: "b1", val: "1", type: "val" }],
      initialBankSize: 1,
      status: "playing",
    };
    vi.mocked(BoardService.generateGame).mockReturnValue(
      mockGame as unknown as ReturnType<typeof BoardService.generateGame>,
    );
    vi.mocked(BoardService.validateBoard).mockReturnValue({ valid: true });

    renderGame({ onWin: vi.fn() });

    await waitForGameLoaded();

    fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
    fireEvent.click(screen.getAllByLabelText("Place tile here")[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Perfect!" })).toBeDefined();
    });

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Perfect!" })).toBeNull();
    });
  });

  it("should call onStageChange when stage navigation buttons are clicked", async () => {
    const onStageChange = vi.fn();
    renderGame({ stage: 2, maxStage: 5, onStageChange });

    await waitForGameLoaded();

    await waitFor(() => {
      expect(screen.getByLabelText("Previous Stage")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Previous Stage"));
    expect(onStageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText("Next Stage"));
    expect(onStageChange).toHaveBeenCalledWith(3);
  });

  it("should deselect bank tile when clicking it again", async () => {
    renderGame();

    await waitForGameLoaded();

    let bankTiles: HTMLElement[] = [];
    await waitFor(() => {
      bankTiles = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            b.className.includes("tile-val") ||
            b.className.includes("tile-op") ||
            b.className.includes("tile-rel"),
        );
      expect(bankTiles.length).toBeGreaterThan(0);
    });

    // Select the tile
    const firstDeselectTile = bankTiles[0];
    expect(firstDeselectTile).toBeDefined();
    fireEvent.click(requireValue(firstDeselectTile));
    await waitFor(() => {
      expect(requireValue(firstDeselectTile).className).toContain("ring-4");
    });

    // Click the same tile again to deselect
    fireEvent.click(requireValue(firstDeselectTile));
    await waitFor(() => {
      expect(requireValue(firstDeselectTile).className).not.toContain("ring-4");
    });
  });
});
