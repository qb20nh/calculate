import { describe, expect, it } from "vitest";
import { resolveMenuRoute } from "@/routes/menuRouteState";
import type { Progress } from "@/services/storage";

describe("menu route resolver", () => {
  const progress: Progress = {
    Easy: { current: 1, max: 2 },
    Medium: { current: 3, max: 1 },
    Hard: { current: 2, max: 6 },
  };

  it("should build a custom game route", () => {
    expect(resolveMenuRoute({ mode: "Custom", progress })).toBe("/game/custom");
  });

  it("should route normal mode to the latest unlocked stage", () => {
    expect(resolveMenuRoute({ mode: "Easy", progress })).toBe("/game/easy?stage=2");
    expect(resolveMenuRoute({ mode: "Hard", progress })).toBe("/game/hard?stage=6");
  });
});
