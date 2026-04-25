import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  generateValidStatement,
  getHashSeed,
  isValidEquation,
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  REL_GT,
  REL_LT,
  xoshiro128pp,
} from "@/services/math";

describe("math service", () => {
  it("should generate consistent hashes", () => {
    expect(getHashSeed("test")).toBe(getHashSeed("test"));
    expect(getHashSeed("test")).not.toBe(getHashSeed("other"));
  });

  it("should produce deterministic random numbers with xoshiro128pp", () => {
    const prng1 = xoshiro128pp(12345);
    const prng2 = xoshiro128pp(12345);
    expect(prng1()).toBe(prng2());
    expect(prng1()).toBe(prng2());
  });

  it("should evaluate simple expressions correctly", () => {
    expect(evaluateExpression(`2${OP_PLUS}3`)).toBe(5);
    expect(evaluateExpression(`10${OP_MINUS}4`)).toBe(6);
    expect(evaluateExpression(`3${OP_MULT}4`)).toBe(12);
    expect(evaluateExpression(`12${OP_DIV}3`)).toBe(4);
  });

  it("should respect operator precedence", () => {
    expect(evaluateExpression(`2${OP_PLUS}3${OP_MULT}4`)).toBe(14);
    expect(evaluateExpression(`10${OP_MINUS}4${OP_DIV}2`)).toBe(8);
  });

  it("should return null for invalid expressions", () => {
    expect(evaluateExpression("")).toBeNull();
    expect(evaluateExpression(`2${OP_PLUS}${OP_PLUS}3`)).toBeNull();
    expect(evaluateExpression(`2${OP_PLUS}`)).toBeNull();
    expect(evaluateExpression(`${OP_PLUS}2`)).toBeNull();
    expect(evaluateExpression(`2${OP_DIV}0`)).toBeNull();
    expect(evaluateExpression(`7${OP_DIV}3`)).toBeNull(); // Only integer division
    expect(evaluateExpression(`01${OP_PLUS}2`)).toBeNull(); // No leading zeros
    expect(evaluateExpression("2+3=5")).toBeNull(); // No relations in evaluateExpression
    expect(evaluateExpression("2a+3")).toBeNull(); // No letters
  });

  it("should generate valid statements", () => {
    const prng = xoshiro128pp(99);
    for (let i = 0; i < 50; i++) {
      const tokens = generateValidStatement(prng);
      expect(tokens.length).toBeGreaterThanOrEqual(5);
      expect(tokens.length).toBeLessThanOrEqual(10);
      // Verify it's a valid equation
      expect(isValidEquation(tokens.map((val) => ({ val })))).toBe(true);
    }
  });

  it("should generate a valid statement for a constant prng", () => {
    const tokens = generateValidStatement(() => 1);
    expect(tokens.length).toBeGreaterThanOrEqual(5);
    expect(tokens.length).toBeLessThanOrEqual(10);
    expect(isValidEquation(tokens.map((val) => ({ val })))).toBe(true);
  });

  describe("isValidEquation", () => {
    it("should validate basic equations", () => {
      expect(
        isValidEquation([
          { val: "2" },
          { val: OP_PLUS },
          { val: "3" },
          { val: REL_EQ },
          { val: "5" },
        ]),
      ).toBe(true);
      expect(
        isValidEquation([
          { val: "2" },
          { val: OP_PLUS },
          { val: "3" },
          { val: REL_EQ },
          { val: "6" },
        ]),
      ).toBe(false);
    });

    it("should validate inequalities", () => {
      expect(
        isValidEquation([
          { val: "2" },
          { val: OP_PLUS },
          { val: "3" },
          { val: REL_LT },
          { val: "10" },
        ]),
      ).toBe(true);
      expect(isValidEquation([{ val: "10" }, { val: REL_GT }, { val: "5" }])).toBe(true);
      expect(isValidEquation([{ val: "5" }, { val: REL_LT }, { val: REL_GT }, { val: "10" }])).toBe(
        true,
      ); // <>
      expect(isValidEquation([{ val: "5" }, { val: REL_LT }, { val: REL_GT }, { val: "5" }])).toBe(
        false,
      ); // <>
    });

    it("should return false for invalid structure", () => {
      expect(isValidEquation([])).toBe(false);
      expect(isValidEquation([{ val: "5" }])).toBe(false); // No relation
      expect(isValidEquation([{ val: REL_EQ }, { val: "5" }])).toBe(false); // Starts with relation
      expect(isValidEquation([{ val: "5" }, { val: REL_EQ }])).toBe(false); // Ends with relation
      expect(
        isValidEquation([
          { val: "5" },
          { val: REL_EQ },
          { val: "5" },
          { val: REL_EQ },
          { val: "5" },
        ]),
      ).toBe(false); // Multiple relations
      expect(isValidEquation([{ val: "5" }, { val: "INVALID" }, { val: "5" }])).toBe(false); // Invalid relation
    });
  });
});
