import { describe, expect, it } from "vitest";
import { buildCustomConfigFromDraft } from "@/routes/customGameForm";
import type { CustomGameConfig } from "@/services/storage";

describe("custom game form helpers", () => {
  it("should normalize draft values before generation", () => {
    const draft: CustomGameConfig = {
      givenCount: 8,
      inventoryCount: 12,
      sizeLimit: 10,
      seed: " abc ",
      limitSolutionSize: false,
    };

    const normalized = buildCustomConfigFromDraft(draft);

    expect(normalized.givenCount).toBe(8);
    expect(normalized.inventoryCount).toBe(12);
    expect(normalized.sizeLimit).toBe(10);
    expect(normalized.seed).toBe("abc");
    expect(normalized.limitSolutionSize).toBe(false);
  });
});
