import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import GameRoute from "@/routes/GameRoute";

// Mock preact-iso's useLocation
const mockRoute = vi.fn();
vi.mock("preact-iso", () => ({
  useLocation: () => ({
    route: mockRoute,
    path: "/game/easy/1",
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
  loadProgress: () => mockLoadProgress(),
  loadGameState: () => mockLoadGameState(),
  saveGameState: vi.fn(),
  saveProgress: vi.fn(),
  parseDifficultySlug: (s: string) => (s === "easy" ? "Easy" : null),
  parseStageParam: (s: string) => Number(s) || null,
  toGamePath: (diff: string, stage: number) => `/game/${diff.toLowerCase()}/${stage}`,
}));

describe("GameRoute", () => {
  it("should handle locked stages", () => {
    mockLoadProgress.mockReturnValue({
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    });

    render(<GameRoute difficulty="easy" stage="10" />);

    expect(screen.getByText("Stage 10 locked")).toBeDefined();

    const latestButton = screen.getByText("Latest available");
    fireEvent.click(latestButton);
    expect(mockRoute).toHaveBeenCalledWith("/game/easy/1");
  });

  it("should handle back button", () => {
    render(<GameRoute difficulty="easy" stage="1" />);

    // Game calls onBack
    const backButton = screen.getAllByLabelText("Back")[0];
    fireEvent.click(backButton);
    expect(mockRoute).toHaveBeenCalledWith("/");
  });

  it("should handle stage change", () => {
    render(<GameRoute difficulty="easy" stage="1" />);

    // Game calls onStageChange when header buttons are clicked
    // But since Game is mocked or we can't easily reach its internals,
    // we should have tested GameRoute's handleStageChange directly if possible.
    // Actually, I can just find the stage navigation button in Game's header.
    const nextButton = screen.getAllByLabelText("Next Stage")[0];
    fireEvent.click(nextButton);
    expect(mockRoute).toHaveBeenCalledWith("/game/easy/2");
  });
});
