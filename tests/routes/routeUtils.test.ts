import { describe, expect, it } from "vitest";
import { addBasePath, normalizeBasePath, removeBasePath } from "@/routes/routeUtils";

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

  it("should remove a project base path from browser routes", () => {
    expect(removeBasePath("/game/easy", "/")).toBe("/game/easy");
    expect(removeBasePath("/calculate?stage=1#top", "/calculate/")).toBe("/?stage=1#top");
    expect(removeBasePath("/calculate/", "/calculate/")).toBe("/");
    expect(removeBasePath("/calculate/game/easy?stage=1", "/calculate/")).toBe(
      "/game/easy?stage=1",
    );
    expect(removeBasePath("/other/game/easy", "/calculate/")).toBe("/other/game/easy");
  });
});
