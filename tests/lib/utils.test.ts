import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("utils", () => {
  it("should merge tailwind classes correctly", () => {
    expect(cn("p-4", "bg-red-500")).toBe("p-4 bg-red-500");
    expect(cn("p-4 p-2")).toBe("p-2"); // Tailwind merge should prefer later classes
    expect(cn("p-4", undefined, null, false, "m-2")).toBe("p-4 m-2");
  });
});
