import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("static SEO assets", () => {
  it("should define a meta description", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('name="description"');
    expect(html).toContain(
      'content="Play Math Crossword, a number puzzle game with standard difficulty stages and custom puzzle setup."',
    );
  });

  it("should provide a valid robots.txt", () => {
    const robotsTxt = readFileSync("public/robots.txt", "utf8");

    expect(robotsTxt.trim()).toBe("User-agent: *\nAllow: /");
  });
});
