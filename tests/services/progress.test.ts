import { describe, expect, it } from "vitest";
import {
  advanceProgress,
  getLatestUnlockedStage,
  isStageLocked,
  resolveRequestedStage,
  unlockStage,
} from "@/services/progress";
import { DEFAULT_PROGRESS, type Progress } from "@/services/storage";

describe("progress service", () => {
  const baseProgress: Progress = {
    Easy: { current: 2, max: 4 },
    Medium: { current: 1, max: 1 },
    Hard: { current: 1, max: 1 },
  };

  it("should resolve requested stages from explicit and saved states", () => {
    expect(
      resolveRequestedStage({
        difficulty: "Easy",
        explicitStage: 7,
        isClient: true,
        savedStateDifficulty: "Easy",
        savedStateStage: 5,
        currentProgress: baseProgress.Easy,
      }),
    ).toBe(7);

    expect(
      resolveRequestedStage({
        difficulty: "Easy",
        explicitStage: null,
        isClient: true,
        savedStateDifficulty: "Easy",
        savedStateStage: 5,
        currentProgress: baseProgress.Easy,
      }),
    ).toBe(5);
  });

  it("should fall back to current progress when no explicit stage is available", () => {
    expect(
      resolveRequestedStage({
        difficulty: "Easy",
        explicitStage: null,
        isClient: true,
        savedStateDifficulty: "Medium",
        savedStateStage: 4,
        currentProgress: baseProgress.Easy,
      }),
    ).toBe(2);
  });

  it("should resolve current progress from request state on SSR-like renders", () => {
    expect(
      resolveRequestedStage({
        difficulty: "Easy",
        explicitStage: null,
        isClient: false,
        savedStateDifficulty: "Medium",
        savedStateStage: 5,
        currentProgress: baseProgress.Easy,
      }),
    ).toBe(2);
  });

  it("should report locked state against max unlocked progress", () => {
    expect(isStageLocked(baseProgress, "Easy", 5)).toBe(true);
    expect(isStageLocked(baseProgress, "Easy", 3)).toBe(false);
  });

  it("should advance progress with optional max updates", () => {
    const bumped = advanceProgress(baseProgress, "Easy", 10, true);
    expect(bumped.Easy).toEqual({ current: 10, max: 10 });

    const same = advanceProgress(baseProgress, "Easy", 2, false);
    expect(same).toEqual(baseProgress);
  });

  it("should unlock progress only when higher than existing max", () => {
    expect(unlockStage(baseProgress, "Easy", 2)).toEqual(baseProgress);
    expect(unlockStage(baseProgress, "Easy", 8)).toEqual({
      ...baseProgress,
      Easy: { ...baseProgress.Easy, max: 8 },
    });
  });

  it("should read latest unlocked stage for menu routing", () => {
    expect(getLatestUnlockedStage(DEFAULT_PROGRESS, "Easy")).toBe(1);
    expect(getLatestUnlockedStage(baseProgress, "Easy")).toBe(4);
  });
});
