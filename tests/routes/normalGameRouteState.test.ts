import { describe, expect, it } from "vitest";
import { resolveNormalGameRouteState } from "@/routes/normalGameRouteState";
import type { Progress } from "@/services/storage";

describe("normal game route state resolver", () => {
  const progress: Progress = {
    Easy: { current: 2, max: 4 },
    Medium: { current: 3, max: 1 },
    Hard: { current: 1, max: 1 },
  };

  it("should use explicit stage from URL when provided", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: true,
      locationUrl: "/game/easy?stage=10",
      savedStateDifficulty: "Easy",
      savedStateStage: 3,
      progress,
    });

    expect(state.requestedStage).toBe(10);
    expect(state.latestUnlockedStage).toBe(4);
    expect(state.stageLocked).toBe(true);
    expect(state.targetPath).toBe("/game/easy?stage=10");
    expect(state.shouldRedirect).toBe(false);
  });

  it("should prefer saved stage when no stage param exists", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: true,
      locationUrl: "/game/easy",
      savedStateDifficulty: "Easy",
      savedStateStage: 3,
      progress,
    });

    expect(state.requestedStage).toBe(3);
    expect(state.targetPath).toBe("/game/easy?stage=3");
    expect(state.shouldRedirect).toBe(true);
  });

  it("should not fallback for invalid numeric stage params", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: true,
      locationUrl: "/game/easy?stage=0",
      savedStateDifficulty: "Easy",
      savedStateStage: 3,
      progress,
    });

    expect(state.requestedStage).toBeNull();
    expect(state.targetPath).toBeNull();
    expect(state.shouldRedirect).toBe(false);
  });

  it("should preserve explicit stage for server renders", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: false,
      locationUrl: "/game/easy?stage=10",
      savedStateDifficulty: "Easy",
      savedStateStage: 3,
      progress,
    });

    expect(state.requestedStage).toBe(10);
    expect(state.targetPath).toBe("/game/easy?stage=10");
    expect(state.shouldRedirect).toBe(false);
  });

  it("should resolve to current stage and redirect when missing/invalid stage", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: true,
      locationUrl: "/game/easy?stage=abc",
      savedStateDifficulty: "Medium",
      savedStateStage: 5,
      progress,
    });

    expect(state.requestedStage).toBe(2);
    expect(state.targetPath).toBe("/game/easy?stage=2");
    expect(state.shouldRedirect).toBe(true);
  });

  it("should use current progress while on server for pre-SSR route", () => {
    const state = resolveNormalGameRouteState({
      difficulty: "Easy",
      isClient: false,
      locationUrl: "/game/easy",
      savedStateDifficulty: "Easy",
      savedStateStage: 3,
      progress,
    });

    expect(state.requestedStage).toBe(2);
    expect(state.targetPath).toBe("/game/easy?stage=2");
    expect(state.shouldRedirect).toBe(false);
  });
});
