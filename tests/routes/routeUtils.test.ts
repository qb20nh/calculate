import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addBasePath,
  normalizeBasePath,
  parseCustomGameConfig,
  parseCustomGameRetryCount,
  parseDifficultySlug,
  parseGameModeSlug,
  removeBasePath,
  toCustomGamePath,
  toGamePath,
} from "@/routes/routeUtils";
import { CUSTOM_GAME_LIMITS } from "@/services/customGameConfig";
import type { CustomGameConfig } from "@/services/storage";

const seedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".split("");
const seedArb = fc
  .array(fc.constantFrom(...seedChars), { maxLength: CUSTOM_GAME_LIMITS.maxSeedLength })
  .map((chars) => chars.join(""));

const validCustomGameConfigArb: fc.Arbitrary<CustomGameConfig> = fc
  .integer({ min: CUSTOM_GAME_LIMITS.minSizeLimit, max: CUSTOM_GAME_LIMITS.maxSizeLimit })
  .chain((sizeLimit) => {
    const maxTotalTiles = Math.min(CUSTOM_GAME_LIMITS.maxTotalTiles, sizeLimit * sizeLimit);
    return fc
      .integer({ min: CUSTOM_GAME_LIMITS.minTotalTiles, max: maxTotalTiles })
      .chain((totalTiles) =>
        fc.integer({ min: 1, max: totalTiles - 1 }).chain((givenCount) =>
          fc
            .record({
              seed: seedArb,
              limitSolutionSize: fc.boolean(),
            })
            .map(({ seed, limitSolutionSize }) => ({
              givenCount,
              inventoryCount: totalTiles - givenCount,
              sizeLimit,
              seed,
              limitSolutionSize,
            })),
        ),
      );
  });

const appPathArb = fc.oneof(
  fc.constant("/"),
  fc.integer({ min: 1, max: 9999 }).map((stage) => toGamePath("Easy", stage)),
  fc.integer({ min: 1, max: 9999 }).map((stage) => toGamePath("Crossing", stage)),
  validCustomGameConfigArb.chain((config) =>
    fc
      .integer({ min: CUSTOM_GAME_LIMITS.minRetryCount, max: CUSTOM_GAME_LIMITS.maxRetryCount })
      .map((retryCount) => toCustomGamePath(config, retryCount)),
  ),
);

const basePathArb = fc.constantFrom("/", "/calculate", "/calculate/");

describe("route utils", () => {
  it("should normalize vite base paths", () => {
    expect(normalizeBasePath("")).toBe("/");
    expect(normalizeBasePath("/")).toBe("/");
    expect(normalizeBasePath("/calculate/")).toBe("/calculate");
    expect(normalizeBasePath("https://example.com/calculate/")).toBe("/calculate");
  });

  it("should add a project base path to app routes", () => {
    expect(addBasePath("/game/easy", "/")).toBe("/game/easy");
    expect(addBasePath("/", "/calculate/")).toBe("/calculate/");
    expect(addBasePath("/game/easy?stage=1", "/calculate/")).toBe("/calculate/game/easy?stage=1");
    expect(addBasePath("/calculate/game/easy", "/calculate/")).toBe("/calculate/game/easy");
  });

  it("should preserve query-stage game paths", () => {
    expect(addBasePath("/game/easy?stage=3", "/")).toBe("/game/easy?stage=3");
  });

  it("should remove a project base path from browser routes", () => {
    expect(removeBasePath("/game/easy", "/")).toBe("/game/easy");
    expect(removeBasePath("/calculate?stage=1#top", "/calculate/")).toBe("/?stage=1#top");
    expect(removeBasePath("/calculate/", "/calculate/")).toBe("/");
    expect(removeBasePath("/calculate/game/easy?stage=1", "/calculate/")).toBe(
      "/game/easy?stage=1",
    );
    expect(removeBasePath("/other/game/easy", "/calculate/")).toBe("/other/game/easy");
  });

  it("should parse custom game mode and custom config", () => {
    expect(parseDifficultySlug()).toBe(null);
    expect(parseGameModeSlug()).toBe(null);
    expect(parseGameModeSlug("custom")).toBe("Custom");
    expect(parseGameModeSlug("crossing")).toBe("Crossing");
    expect(parseGameModeSlug("easy")).toBe("Easy");
    expect(toGamePath("Crossing", 3)).toBe("/game/crossing?stage=3");

    const parsed = parseCustomGameConfig(
      new URLSearchParams("given=6&inventory=10&size=10&seed=123"),
    );
    expect(parsed).toEqual({
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
    });

    expect(
      toCustomGamePath({
        givenCount: 6,
        inventoryCount: 10,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: false,
      }),
    ).toBe("/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=0");
    expect(
      toCustomGamePath({
        givenCount: 6,
        inventoryCount: 10,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: true,
      }),
    ).toBe("/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=0&limitSolutionSize=1");

    expect(
      toCustomGamePath(
        {
          givenCount: 6,
          inventoryCount: 10,
          sizeLimit: 10,
          seed: "123",
          limitSolutionSize: false,
        },
        37,
      ),
    ).toBe("/game/custom?given=6&inventory=10&size=10&seed=123&retryCount=37");

    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&limitSolutionSize=1"),
      ),
    ).toEqual({
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: true,
    });
    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&retryCount=37"),
      ),
    ).toEqual({
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
      attempt: 37,
    });
  });

  it("should reject invalid custom flags", () => {
    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&limitSolutionSize=2"),
      ),
    ).toBe(null);
  });

  it("should handle invalid retryCount in searchParams", () => {
    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&retryCount=abc"),
      ),
    ).toBe(null);
    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&retryCount=-1"),
      ),
    ).toBe(null);
  });

  it("should parse custom game retry count", () => {
    expect(parseCustomGameRetryCount(new URLSearchParams())).toBe(0);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=10"))).toBe(10);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=abc"))).toBe(0);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=-1"))).toBe(0);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=10000"))).toBe(0);
  });

  it("should reject custom game configs outside sane caps", () => {
    expect(
      parseCustomGameConfig(new URLSearchParams("given=60&inventory=61&size=20&seed=123")),
    ).toBe(null);
    expect(
      parseCustomGameConfig(new URLSearchParams("given=6&inventory=10&size=21&seed=123")),
    ).toBe(null);
    expect(
      parseCustomGameConfig(
        new URLSearchParams(`given=6&inventory=10&size=10&seed=${"x".repeat(65)}`),
      ),
    ).toBe(null);
  });

  it("should round-trip valid custom game urls", () => {
    fc.assert(
      fc.property(
        validCustomGameConfigArb,
        fc.integer({
          min: CUSTOM_GAME_LIMITS.minRetryCount,
          max: CUSTOM_GAME_LIMITS.maxRetryCount,
        }),
        (config, retryCount) => {
          const path = toCustomGamePath(config, retryCount);
          const searchParams = new URLSearchParams(path.split("?")[1] ?? "");

          expect(parseCustomGameConfig(searchParams)).toEqual({
            ...config,
            attempt: retryCount,
          });
          expect(parseCustomGameRetryCount(searchParams)).toBe(retryCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should remove app base paths that were added", () => {
    fc.assert(
      fc.property(appPathArb, basePathArb, (path, basePath) => {
        expect(removeBasePath(addBasePath(path, basePath), basePath)).toBe(path);
      }),
      { numRuns: 100 },
    );
  });
});
