import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import GameRoute from "@/routes/GameRoute";

const requireValue = <T,>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("Expected value");
  }
  return value;
};

// Mock preact-iso's useLocation
const mockRoute = vi.fn();
let mockLocationUrl = "/game/easy?stage=1";
vi.mock("preact-iso", () => ({
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
  parseDifficultySlug: (s: string) => (s === "easy" ? "Easy" : null),
  parseStageParam: (s: string) => Number(s) || null,
  toGamePath: (diff: string, stage: number) => `/game/${diff.toLowerCase()}?stage=${stage}`,
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

    expect(screen.getByText("Stage 10 locked")).toBeDefined();
    expect(
      screen.getByText(
        "This level is not unlocked yet. Use the buttons below to leave or continue.",
      ),
    ).toBeDefined();
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
    // But since Game is mocked or we can't easily reach its internals,
    // we should have tested GameRoute's handleStageChange directly if possible.
    // Actually, I can just find the stage navigation button in Game's header.
    fireEvent.click(requireValue(screen.getAllByLabelText("Next Stage")[0]));
    expect(mockRoute).toHaveBeenCalledWith("/game/easy?stage=2");
  });
});
