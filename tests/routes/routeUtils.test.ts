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
} from "@/routes/routeUtils";

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
    expect(parseGameModeSlug("easy")).toBe("Easy");

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
    ).toEqual({
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
    });
    expect(
      parseCustomGameConfig(
        new URLSearchParams("given=6&inventory=10&size=10&seed=123&retryCount=-1"),
      ),
    ).toEqual({
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
    });
  });

  it("should parse custom game retry count", () => {
    expect(parseCustomGameRetryCount(new URLSearchParams())).toBe(0);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=10"))).toBe(10);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=abc"))).toBe(0);
    expect(parseCustomGameRetryCount(new URLSearchParams("retryCount=-1"))).toBe(0);
  });
});
