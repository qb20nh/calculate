import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "@/components/Game";
import * as BoardService from "@/services/board";
import { generateGame } from "@/services/board";
import type { GameState } from "@/services/storage";

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

const enableNativeDialogSupport = () => {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });

  const previousShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: close,
  });

  return {
    showModal,
    close,
    restore: () => {
      if (previousShowModal) {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShowModal);
      } else {
        delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
      }

      if (previousClose) {
        Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      } else {
        delete (HTMLDialogElement.prototype as { close?: unknown }).close;
      }
    },
  };
};

const makeGameState = (overrides: Partial<GameState> = {}): GameState => ({
  ...generateGame(1, "Easy"),
  difficulty: "Easy",
  stage: 1,
  ...overrides,
});

describe("Game", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock pointer capture APIs
    HTMLDivElement.prototype.setPointerCapture = vi.fn();
    HTMLDivElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLDivElement.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the board without a manual generation delay", async () => {
    renderGame();

    await waitForGameLoaded();

    expect(screen.getAllByText("Easy — Stage 1").length).toBeGreaterThan(0);
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

    expect(screen.getAllByText("Easy — Stage 1").length).toBeGreaterThan(0);
    const boardContainer = screen.getByTestId("game-board-container");
    expect(boardContainer.querySelector(".animate-fade-in")).toBeNull();
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
      const className = requireValue(firstBankTile).className;
      expect(className).toContain("selected");
      expect(className).not.toContain("scale-110");
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
      expect(screen.getAllByText("Easy — Stage 1").length).toBeGreaterThan(0);
    });

    const resetButton = screen.getByLabelText("Reset Stage");
    fireEvent.click(resetButton);

    const dialog = screen.getByRole("dialog", { name: "Reset this stage?" });
    expect(dialog).toBeDefined();

    fireEvent.click(screen.getByText("Reset"));

    expect(screen.getAllByText("Easy — Stage 1").length).toBeGreaterThan(0);
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

  it("should close the reset dialog when Cancel is clicked", async () => {
    renderGame();

    await waitForGameLoaded();

    fireEvent.click(screen.getByLabelText("Reset Stage"));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("dialog", { name: "Reset this stage?" })).toBeNull();
  });

  it("should close the reset dialog from the native cancel event", async () => {
    const dialogSupport = enableNativeDialogSupport();
    try {
      renderGame();

      await waitForGameLoaded();

      fireEvent.click(screen.getByLabelText("Reset Stage"));
      const dialog = await screen.findByRole("dialog", { name: "Reset this stage?" });
      expect(dialogSupport.showModal).toHaveBeenCalledTimes(1);

      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Reset this stage?" })).toBeNull();
      });
    } finally {
      dialogSupport.restore();
    }
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

    const dialogSupport = enableNativeDialogSupport();
    try {
      fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
      fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));

      await screen.findByRole("dialog", { name: "Perfect!" });
      expect(dialogSupport.showModal).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Perfect!" })).toBeDefined();
      });

      fireEvent.click(screen.getByText("Dismiss"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Perfect!" })).toBeNull();
      });
    } finally {
      dialogSupport.restore();
    }
  });

  it("should call onStageChange when stage navigation buttons are clicked", async () => {
    const onStageChange = vi.fn();
    renderGame({ stage: 2, maxStage: 5, onStageChange });

    await waitForGameLoaded();

    await waitFor(() => {
      expect(screen.getAllByLabelText("Previous Stage").length).toBeGreaterThan(0);
    });

    fireEvent.click(requireValue(screen.getAllByLabelText("Previous Stage")[0]));
    expect(onStageChange).toHaveBeenCalledWith(1);

    fireEvent.click(requireValue(screen.getAllByLabelText("Next Stage")[0]));
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
      const className = requireValue(firstDeselectTile).className;
      expect(className).toContain("selected");
      expect(className).not.toContain("scale-110");
    });

    // Click the same tile again to deselect
    fireEvent.click(requireValue(firstDeselectTile));
    await waitFor(() => {
      expect(requireValue(firstDeselectTile).className).not.toContain("selected");
    });
  });

  describe("Interactions", () => {
    it("should handle touch panning with threshold", async () => {
      renderGame();
      await waitForGameLoaded();

      const container = screen.getByTestId("game-board-container");

      // Pointer down
      fireEvent.pointerDown(container, {
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });

      // Pointer move below threshold
      fireEvent.pointerMove(container, {
        clientX: 102,
        clientY: 102,
      });

      // Pointer move above threshold (4px)
      fireEvent.pointerMove(container, {
        clientX: 110,
        clientY: 110,
      });

      // Pointer up
      fireEvent.pointerUp(container);

      expect(container).toBeDefined();
    });

    it("should ignore mouse dragging for panning", async () => {
      renderGame();
      await waitForGameLoaded();

      const container = screen.getByTestId("game-board-container");

      // Pointer down with mouse
      fireEvent.pointerDown(container, {
        pointerType: "mouse",
        clientX: 100,
        clientY: 100,
      });

      fireEvent.pointerMove(container, {
        clientX: 150,
        clientY: 150,
      });

      fireEvent.pointerUp(container);
      expect(container).toBeDefined();
    });

    it("should handle pointer cancel", async () => {
      renderGame();
      await waitForGameLoaded();

      const container = screen.getByTestId("game-board-container");

      fireEvent.pointerDown(container, {
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });

      fireEvent.pointerCancel(container);
      expect(container).toBeDefined();
    });

    it("should handle pointer leave", async () => {
      renderGame();
      await waitForGameLoaded();

      const container = screen.getByTestId("game-board-container");

      fireEvent.pointerDown(container, {
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });

      fireEvent.pointerLeave(container);
      expect(container).toBeDefined();
    });

    it("should suppress clicks after dragging", async () => {
      renderGame();
      await waitForGameLoaded();

      const container = screen.getByTestId("game-board-container");

      // Drag
      fireEvent.pointerDown(container, { pointerType: "touch", clientX: 100, clientY: 100 });
      fireEvent.pointerMove(container, { clientX: 150, clientY: 150 });
      fireEvent.pointerUp(container);

      // Subsequent click should be captured/suppressed
      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      const spy = vi.spyOn(clickEvent, "stopPropagation");
      fireEvent(container, clickEvent);

      expect(spy).toHaveBeenCalled();
    });

    it("should ignore panning when game is not playing", async () => {
      // Start a game
      renderGame();
      await waitForGameLoaded();

      // Force it to solved state (or just mock it)
      // Actually, let's just render with solved state
      const solvedState: GameState = makeGameState({ status: "won" });
      cleanup(); // Remove previous render
      renderGame({ initialState: solvedState });

      const container = screen.getByTestId("game-board-container");
      fireEvent.pointerDown(container, { pointerType: "touch", clientX: 100, clientY: 100 });
      // Move - should not crash or do much
      fireEvent.pointerMove(container, { clientX: 150, clientY: 150 });
      fireEvent.pointerUp(container);

      expect(container).toBeDefined();
    });

    it("should handle inventory selection and stacking", async () => {
      const customState: GameState = {
        ...makeGameState(),
        bank: [
          { id: "v1", val: "5", type: "val" },
          { id: "v2", val: "5", type: "val" },
          { id: "o1", val: "+", type: "op" },
          { id: "r1", val: "=", type: "rel" },
        ],
      };
      renderGame({ initialState: customState });
      await waitForGameLoaded();

      // Find the '5' tile in inventory (should have a stack badge '2')
      const fiveTile = screen.getByText("5").closest("button");
      if (fiveTile) {
        expect(screen.getByText("2")).toBeDefined();

        // Select it
        fireEvent.click(fiveTile);
        expect(fiveTile.className).toContain("selected");

        // Deselect it
        fireEvent.click(fiveTile);
        expect(fiveTile.className).not.toContain("selected");
      }
    });

    it("should ignore inventory clicks when game is solved", async () => {
      const solvedState: GameState = makeGameState({ status: "won" });
      renderGame({ initialState: solvedState });
      await waitForGameLoaded();

      const buttons = screen.getAllByRole("button");
      const tile = buttons.find((b) => b.className.includes("tile-"));
      if (tile) {
        fireEvent.click(tile);
        expect(tile.className).not.toContain("selected");
      }
    });

    it("should handle operator and relation stacking", async () => {
      const customState: GameState = {
        ...makeGameState(),
        bank: [
          { id: "o1", val: "+", type: "op" },
          { id: "o2", val: "+", type: "op" },
          { id: "r1", val: "=", type: "rel" },
          { id: "r2", val: "=", type: "rel" },
        ],
      };
      renderGame({ initialState: customState });
      await waitForGameLoaded();

      expect(screen.getAllByText("2")).toHaveLength(2); // Two stack badges of '2'
    });

    it("should focus the dismiss button when the completion dialog opens", async () => {
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

      const dialogSupport = enableNativeDialogSupport();
      try {
        fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
        fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));

        await screen.findByRole("dialog", { name: "Perfect!" });
        await waitFor(() => {
          expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dismiss" }));
        });
      } finally {
        dialogSupport.restore();
      }
    });

    it("should dismiss the completion dialog from the native cancel event", async () => {
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

      const dialogSupport = enableNativeDialogSupport();
      try {
        renderGame({ onWin: vi.fn() });
        await waitForGameLoaded();

        fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
        fireEvent.click(requireValue(screen.getAllByLabelText("Place tile here")[0]));

        const dialog = await screen.findByRole("dialog", { name: "Perfect!" });
        dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

        await waitFor(() => {
          expect(screen.queryByRole("dialog", { name: "Perfect!" })).toBeNull();
        });
      } finally {
        dialogSupport.restore();
      }
    });
  });
});
