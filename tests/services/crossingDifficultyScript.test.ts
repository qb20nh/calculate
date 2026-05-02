import { describe, expect, it } from "vitest";
import {
  buildCrossingGameFromSpec,
  type CrossingLevelSpec,
} from "@/services/board/handcraftedLevels";
import { rankCrossingDifficulty } from "../../scripts/rankCrossingDifficulty.mjs";

type RankedCrossingResult = {
  score: number;
  stage: number;
  solutionCount: number;
  solutionTiles: number;
};

describe("crossing difficulty script", () => {
  it("should rank current crossing stages in increasing difficulty", async () => {
    const report = await rankCrossingDifficulty();
    const ranked = report.ranked as RankedCrossingResult[];
    const scores = ranked.map((result) => result.score);
    const baseScore = scores[0] ?? 0;
    const targetMultiplier = 10 ** (1 / 8);

    expect(ranked.map((result) => result.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ranked.every((result) => result.solutionCount === 1)).toBe(true);
    expect([...ranked.map((result) => result.solutionTiles)].sort()).toEqual([
      27, 27, 27, 27, 27, 27, 27, 27, 27,
    ]);
    expect(scores).toEqual([...scores].sort((left, right) => left - right));
    expect((scores.at(-1) ?? 0) / baseScore).toBeGreaterThanOrEqual(9);
    expect((scores.at(-1) ?? 0) / baseScore).toBeLessThanOrEqual(11);
    for (let index = 0; index < scores.length; index++) {
      const normalizedScore = (scores[index] ?? 0) / (baseScore * targetMultiplier ** index);
      expect(normalizedScore).toBeGreaterThanOrEqual(0.9);
      expect(normalizedScore).toBeLessThanOrEqual(1.1);
    }
  });

  it("should expose deterministic spec generation for candidate search", () => {
    const spec = {
      pattern: { cols: [1, 3, 4], rows: [1, 2, 4] },
      solutionTiles: 27,
      removalVariant: 2,
      formulas: {
        horizontals: ["9=8+1", "21÷3=7", "34=17×2"],
        verticals: ["5=1+4", "7+3=10", "21=27−6"],
      },
    } as const satisfies CrossingLevelSpec;

    expect(buildCrossingGameFromSpec(spec)).not.toBeNull();
    expect(buildCrossingGameFromSpec({ ...spec, removalVariant: 1 })).not.toBeNull();
    expect(buildCrossingGameFromSpec({ ...spec, solutionTiles: 26 })).toBeNull();
    expect(buildCrossingGameFromSpec({ ...spec, removalVariant: 9999 })).toBeNull();
    expect(
      buildCrossingGameFromSpec({
        ...spec,
        formulas: {
          horizontals: ["missing", "21÷3=7", "34=17×2"],
          verticals: spec.formulas.verticals,
        },
      }),
    ).toBeNull();
    expect(
      buildCrossingGameFromSpec({
        ...spec,
        formulas: {
          horizontals: ["9=8+1", "1+8=9", "34=17×2"],
          verticals: spec.formulas.verticals,
        },
      }),
    ).toBeNull();
    expect(
      buildCrossingGameFromSpec({
        pattern: { cols: [200, 201, 202], rows: [200, 201, 202] },
        solutionTiles: 27,
        formulas: spec.formulas,
      }),
    ).toBeNull();
  });
});
