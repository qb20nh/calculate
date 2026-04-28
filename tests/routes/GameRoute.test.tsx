import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import GameRoute from "@/routes/GameRoute";
import type { GameState } from "@/services/storage";

const requireValue = <T,>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("Expected value");
  }
  return value;
};

// Mock preact-iso's useLocation
const mockRoute = vi.fn();
let mockLocationUrl = "/game/easy?stage=1";
vi.mock("preact-iso/router", () => ({
  useLocation: () => ({
    route: mockRoute,
    path: "/game/easy",
    url: mockLocationUrl,
  }),
}));

// Mock storage
const mockLoadProgress = vi.fn(() => ({
  Easy: { current: 1, max: 1 },
  Medium: { current: 1, max: 1 },
  Hard: { current: 1, max: 1 },
}));
const mockLoadGameState = vi.fn(() => null);

vi.mock("@/routes/CustomGameRoute", () => ({
  default: () => <div>Custom Setup</div>,
}));

vi.mock("@/services/storage", () => ({
  DEFAULT_PROGRESS: {
    Easy: { current: 1, max: 1 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
  },
  loadProgress: () => mockLoadProgress(),
  loadGameState: () => mockLoadGameState(),
  saveGameState: vi.fn(),
  saveProgress: vi.fn(),
}));

vi.mock("@/components/Game", () => ({
  Game: ({
    onWin,
    onStateChange,
    onBack,
    onStageChange,
    stage,
  }: {
    onWin: (s: number) => void;
    onStateChange: (s: GameState) => void;
    onBack: () => void;
    onStageChange: (s: number) => void;
    stage: number;
  }) => (
    <div>
      <button type="button" onClick={() => onWin(stage + 1)}>
        Mock Win
      </button>
      <button type="button" onClick={() => onStateChange({ status: "won", stage } as GameState)}>
        Mock State Won
      </button>
      <button
        type="button"
        onClick={() => onStateChange({ status: "playing", stage } as GameState)}
      >
        Mock State Playing
      </button>
      <button type="button" onClick={() => onStageChange(stage + 1)} aria-label="Next Stage">
        Next Stage
      </button>
      <button type="button" onClick={onBack} aria-label="Back">
        Back
      </button>
    </div>
  ),
  GameLoadingShell: () => <div>Loading...</div>,
  UnavailableLevelShell: ({
    onReset,
    requestedStage,
    availableStage,
  }: {
    onReset: () => void;
    requestedStage: number;
    availableStage: number;
  }) => (
    <div>
      Stage {requestedStage} locked
      <button type="button" onClick={onReset} aria-label="Reset Stage">
        Reset
      </button>
      <button type="button" onClick={onReset}>
        Go to stage {availableStage}
      </button>
      This level is not unlocked yet. Use the buttons below to leave or continue.
    </div>
  ),
}));

describe("GameRoute", () => {
  it("should handle locked stages", () => {
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    mockLocationUrl = "/game/easy?stage=10";

    render(<GameRoute difficulty="easy" />);

    expect(screen.getByText(/Stage 10 locked/)).toBeDefined();
    expect(screen.getByText(/This level is not unlocked yet/)).toBeDefined();
    expect(screen.getByText("Go to stage 1")).toBeDefined();

    fireEvent.click(screen.getByText("Go to stage 1"));
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=1");
  });

  it("should handle back button", () => {
    mockLocationUrl = "/game/easy?stage=1";
    render(<GameRoute difficulty="easy" />);

    // Game calls onBack
    fireEvent.click(requireValue(screen.getAllByLabelText("Back")[0]));
    expect(mockRoute).toHaveBeenCalledWith("/");
  });

  it("should handle stage change", () => {
    mockLocationUrl = "/game/easy?stage=1";
    render(<GameRoute difficulty="easy" />);

    // Game calls onStageChange when header buttons are clicked
    fireEvent.click(requireValue(screen.getAllByLabelText("Next Stage")[0]));
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=2");
  });

  it("should render NotFoundRoute for invalid difficulty", () => {
    render(<GameRoute difficulty="invalid" />);
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  it("should keep hook order stable when route changes from invalid to valid", async () => {
    mockLocationUrl = "/game/easy?stage=1";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<GameRoute difficulty="invalid" />);

    rerender(<GameRoute difficulty="easy" />);

    await waitFor(() => {
      expect(screen.getByText("Mock Win")).toBeDefined();
    });
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("change in the order"));
    consoleError.mockRestore();
  });

  it("should handle redirect when stage is not specified", () => {
    mockLocationUrl = "/game/easy";
    render(<GameRoute difficulty="easy" />);
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=1", true);
  });

  it("should handle invalid stage param", () => {
    mockLocationUrl = "/game/easy?stage=abc";
    render(<GameRoute difficulty="easy" />);
    // Should default to stage 1 or current progress
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=1", true);
  });

  it("should use a matching saved stage when no stage is specified", async () => {
    mockLocationUrl = "/game/easy";
    mockRoute.mockClear();
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 3 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    mockLoadGameState.mockReturnValueOnce({
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Easy",
      stage: 3,
    } as never);

    render(<GameRoute difficulty="easy" />);

    await waitFor(() => {
      expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=3", true);
    });
  });

  it("should handle handleWin from Game component", () => {
    mockLocationUrl = "/game/easy?stage=1";
    render(<GameRoute difficulty="easy" />);

    // Game calls onWin
    fireEvent.click(screen.getByText("Mock Win"));
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=2");
  });

  it("should handle handleStateChange with won status", () => {
    mockLocationUrl = "/game/easy?stage=1";
    render(<GameRoute difficulty="easy" />);

    // Game calls onStateChange with won status
    fireEvent.click(screen.getByText("Mock State Won"));
    // This should trigger updateMaxProgress(2)
  });

  it("should ignore non-won state updates", () => {
    mockLocationUrl = "/game/easy?stage=1";
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 3 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });

    render(<GameRoute difficulty="easy" />);

    mockRoute.mockClear();
    fireEvent.click(screen.getByText("Mock State Playing"));
    expect(mockRoute).not.toHaveBeenCalledWith("/game/easy?stage=2");
  });

  it("should not lower an already higher unlocked stage", () => {
    mockLocationUrl = "/game/easy?stage=1";
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 3 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });

    render(<GameRoute difficulty="easy" />);

    mockRoute.mockClear();
    fireEvent.click(screen.getByText("Mock State Won"));
    expect(mockRoute).not.toHaveBeenCalledWith("/game/easy?stage=2", true);
  });

  it("should handle reset in UnavailableLevelShell", () => {
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });
    mockLocationUrl = "/game/easy?stage=10";

    render(<GameRoute difficulty="easy" />);

    const resetButton = screen.getByLabelText("Reset Stage");
    fireEvent.click(resetButton);
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=1");
  });

  it("should render custom setup screen", () => {
    mockLocationUrl = "/game/custom";

    render(<GameRoute difficulty="custom" />);

    expect(screen.getByText("Custom Setup")).toBeDefined();
  });
});
