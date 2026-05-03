import { describe, expect, it } from "vitest";
import { resolveCrossingGameRouteState } from "@/routes/crossingGameRouteState";
import type { Progress } from "@/services/storage";

describe("crossing game route state resolver", () => {
  const progress: Progress = {
    Easy: { current: 1, max: 1 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
    Crossing: { current: 2, max: 3 },
  };

  it("should use explicit stages and lock unopened crossing stages", () => {
    const state = resolveCrossingGameRouteState({
      isClient: true,
      locationUrl: "/game/crossing?stage=5",
      maxStage: 9,
      progress,
      savedStateStage: 3,
    });

    expect(state.requestedStage).toBe(5);
    expect(state.latestUnlockedStage).toBe(3);
    expect(state.stageLocked).toBe(true);
    expect(state.targetPath).toBe("/game/crossing?stage=5");
    expect(state.shouldRedirect).toBe(false);
    expect(state.isNotFound).toBe(false);
  });

  it("should prefer saved crossing stages when no stage is explicit", () => {
    const state = resolveCrossingGameRouteState({
      isClient: true,
      locationUrl: "/game/crossing",
      maxStage: 9,
      progress,
      savedStateStage: 3,
    });

    expect(state.requestedStage).toBe(3);
    expect(state.targetPath).toBe("/game/crossing?stage=3");
    expect(state.shouldRedirect).toBe(true);
  });

  it("should reject stages past the handcrafted crossing range", () => {
    const state = resolveCrossingGameRouteState({
      isClient: true,
      locationUrl: "/game/crossing?stage=10",
      maxStage: 9,
      progress,
      savedStateStage: null,
    });

    expect(state.requestedStage).toBe(10);
    expect(state.isNotFound).toBe(true);
    expect(state.shouldRedirect).toBe(false);
  });
});
