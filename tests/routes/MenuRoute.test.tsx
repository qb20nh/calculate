import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import MenuRoute from "@/routes/MenuRoute";

const mockRoute = vi.fn();

// Mock preact-iso's useLocation
vi.mock("preact-iso/router", () => ({
  useLocation: () => ({
    route: mockRoute,
  }),
}));

// Mock storage
vi.mock("@/services/storage", () => ({
  loadProgress: () => ({
    Easy: { current: 1, max: 1 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
  }),
  toGamePath: (diff: string, stage: number) => `/game/${diff.toLowerCase()}?stage=${stage}`,
}));

describe("MenuRoute", () => {
  it("should call onGameRoutePreload intent", () => {
    const onPreload = vi.fn();
    render(<MenuRoute onGameRoutePreload={onPreload} />);

    // MainMenu calls onStartIntent on hover
    const easyButton = screen.getByText("Easy").closest("button");
    if (easyButton) {
      fireEvent.pointerEnter(easyButton);
    }

    expect(onPreload).toHaveBeenCalled();
  });

  it("should route custom mode to setup screen", () => {
    render(<MenuRoute onGameRoutePreload={vi.fn()} />);

    fireEvent.click(screen.getByText("Custom"));
    expect(mockRoute).toHaveBeenCalledWith("/game/custom");
  });
});
