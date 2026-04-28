import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuRoute from "@/routes/MenuRoute";

const mocks = vi.hoisted(() => ({
  ensureDeferredStylesheets: vi.fn(),
  loadingStart: vi.fn(),
  loadingStop: vi.fn(),
  progress: {
    Easy: { current: 1, max: 1 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
  },
  route: vi.fn(),
}));

// Mock preact-iso's useLocation
vi.mock("preact-iso/router", () => ({
  useLocation: () => ({
    route: mocks.route,
  }),
}));

vi.mock("@/lib/deferredStylesheet", () => ({
  ensureDeferredStylesheets: mocks.ensureDeferredStylesheets,
}));

vi.mock("@/services/loading", () => ({
  ROUTE_TRANSITION_LOADING_KEY: "route-transition",
  loadingService: {
    start: mocks.loadingStart,
    stop: mocks.loadingStop,
  },
}));

// Mock storage
vi.mock("@/services/storage", () => ({
  loadProgress: () => mocks.progress,
  toGamePath: (diff: string, stage: number) => `/game/${diff.toLowerCase()}?stage=${stage}`,
}));

describe("MenuRoute", () => {
  beforeEach(() => {
    mocks.ensureDeferredStylesheets.mockReset();
    mocks.ensureDeferredStylesheets.mockReturnValue(undefined);
    mocks.loadingStart.mockClear();
    mocks.loadingStop.mockClear();
    mocks.progress = {
      Easy: { current: 1, max: 1 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    };
    mocks.route.mockClear();
  });

  it("should call onGameRoutePreload intent", () => {
    const onPreload = vi.fn();
    render(<MenuRoute onGameRoutePreload={onPreload} />);

    // MainMenu calls onStartIntent on hover
    const easyButton = screen.getByText("Easy").closest("button");
    if (easyButton) {
      fireEvent.pointerEnter(easyButton);
    }

    expect(onPreload).toHaveBeenCalled();
    expect(mocks.ensureDeferredStylesheets).toHaveBeenCalled();
  });

  it("should route a standard difficulty to the max unlocked stage", () => {
    mocks.progress = {
      Easy: { current: 1, max: 5 },
      Medium: { current: 1, max: 1 },
      Hard: { current: 1, max: 1 },
    };
    render(<MenuRoute />);

    fireEvent.click(screen.getByText("Easy"));

    expect(mocks.route).toHaveBeenCalledWith("/game/easy?stage=5");
  });

  it("should route custom mode to setup screen after deferred styles load", async () => {
    let resolveStyles: () => void = () => {};
    mocks.ensureDeferredStylesheets.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStyles = resolve;
      }),
    );
    render(<MenuRoute onGameRoutePreload={vi.fn()} />);

    fireEvent.click(screen.getByText("Custom"));
    expect(mocks.ensureDeferredStylesheets).toHaveBeenCalled();
    expect(mocks.loadingStart).toHaveBeenCalledWith("route-styles");
    expect(mocks.route).not.toHaveBeenCalled();

    resolveStyles();

    await waitFor(() => {
      expect(mocks.route).toHaveBeenCalledWith("/game/custom");
    });
    expect(mocks.loadingStop).toHaveBeenCalledWith("route-styles");
  });

  it("should wait for the game route preload before routing", async () => {
    let resolvePreload: () => void = () => {};
    const onPreload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    render(<MenuRoute onGameRoutePreload={onPreload} />);

    fireEvent.click(screen.getByText("Custom"));
    expect(onPreload).toHaveBeenCalled();
    expect(mocks.loadingStart).toHaveBeenCalledWith("route-styles");
    expect(mocks.route).not.toHaveBeenCalled();

    resolvePreload();

    await waitFor(() => {
      expect(mocks.route).toHaveBeenCalledWith("/game/custom");
    });
    expect(mocks.loadingStop).toHaveBeenCalledWith("route-styles");
  });
});
