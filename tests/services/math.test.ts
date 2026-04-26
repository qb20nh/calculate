import fc from "fast-check";
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
  const referenceEvaluateExpression = (str: string) => {
    if (str.length === 0) return null;

    const normalized = str
      .replaceAll(OP_MINUS, "-")
      .replaceAll(OP_MULT, "*")
      .replaceAll(OP_DIV, "/");

    if (/[+\-*/]{2,}/.test(normalized)) return null;
    if (/^[+\-*/]/.test(normalized)) return null;
    if (/[+\-*/]$/.test(normalized)) return null;
    if (!/^[0-9+\-*/]+$/.test(normalized)) return null;
    if (/(^|[+\-*/])0\d+/.test(normalized)) return null;

    const tokens = normalized.match(/\d+|[+\-*/]/g);
    if (!tokens) return null;

    const values: number[] = [];
    const ops: Array<"+" | "-"> = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (!t) return null;

      if (t === "*" || t === "/") {
        const left = values.pop();
        if (left === undefined) return null;

        const rightToken = tokens[++i];
        if (!rightToken) return null;

        const right = Number(rightToken);
        if (!Number.isFinite(right)) return null;

        if (t === "*") {
          values.push(left * right);
        } else {
          if (right === 0) return null;
          if (left % right !== 0) return null;
          values.push(left / right);
        }
      } else if (t === "+" || t === "-") {
        ops.push(t);
      } else {
        const value = Number(t);
        if (!Number.isFinite(value)) return null;
        values.push(value);
      }
    }

    const first = values[0];
    if (first === undefined) return null;

    let res = first;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const right = values[i + 1];
      if (right === undefined) return null;

      if (op === "+") res += right;
      if (op === "-") res -= right;
    }

    if (!Number.isFinite(res)) return null;
    return res;
  };

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
    expect(evaluateExpression(`10${OP_MINUS}4${OP_MINUS}2`)).toBe(4);
    expect(evaluateExpression(`2${OP_MULT}3${OP_MULT}4`)).toBe(24);
    expect(evaluateExpression(`12${OP_DIV}3${OP_DIV}2`)).toBe(2);
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

  it("should match reference evaluator for generated expressions", () => {
    const expressionArb = fc
      .array(fc.integer({ min: 0, max: 999 }), { minLength: 1, maxLength: 6 })
      .chain((terms) =>
        fc
          .array(fc.constantFrom("+", OP_MINUS, OP_MULT, OP_DIV), {
            minLength: terms.length - 1,
            maxLength: terms.length - 1,
          })
          .map((ops) => ({
            expression: terms.map((term, index) => `${term}${ops[index] ?? ""}`).join(""),
          })),
      );

    fc.assert(
      fc.property(expressionArb, ({ expression }) => {
        expect(evaluateExpression(expression)).toBe(referenceEvaluateExpression(expression));
      }),
      { numRuns: 300 },
    );
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

  it("should always generate valid statements across seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const prng = xoshiro128pp(seed);
        const tokens = generateValidStatement(prng);

        expect(tokens.length).toBeGreaterThanOrEqual(5);
        expect(tokens.length).toBeLessThanOrEqual(10);
        expect(isValidEquation(tokens.map((val) => ({ val })))).toBe(true);
      }),
      { numRuns: 400 },
    );
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
      expect(
        isValidEquation([
          { val: "10" },
          { val: OP_MINUS },
          { val: "5" },
          { val: REL_GT },
          { val: "4" },
        ]),
      ).toBe(true);
      expect(
        isValidEquation([
          { val: "5" },
          { val: OP_PLUS },
          { val: "5" },
          { val: REL_LT },
          { val: REL_GT },
          { val: "11" },
        ]),
      ).toBe(true); // <>
      expect(
        isValidEquation([
          { val: "5" },
          { val: OP_PLUS },
          { val: "5" },
          { val: REL_LT },
          { val: REL_GT },
          { val: "10" },
        ]),
      ).toBe(false); // <>
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

    it("should cover all relRoll branches in generateValidStatement", () => {
      // 0.75 < relRoll <= 0.83 -> REL_LT
      expect(generateValidStatement(() => 0.8)).toContain(REL_LT);
      // 0.83 < relRoll <= 0.91 -> REL_GT
      expect(generateValidStatement(() => 0.85)).toContain(REL_GT);
      // relRoll > 0.91 -> REL_NEQ
      const neqTokens = generateValidStatement(() => 0.95);
      expect(neqTokens).toContain(REL_LT);
      expect(neqTokens).toContain(REL_GT);
    });

    it("should cover applyRelation branches", () => {
      // Since generateValidStatement uses the PRNG, this is tricky to hit exactly,
      // but let's test isValidEquation with forced REL_NEQ
      expect(
        isValidEquation([
          { val: "5" },
          { val: OP_PLUS },
          { val: "1" },
          { val: REL_LT },
          { val: REL_GT },
          { val: "7" },
        ]),
      ).toBe(true);
      expect(
        isValidEquation([
          { val: "5" },
          { val: OP_PLUS },
          { val: "1" },
          { val: REL_LT },
          { val: REL_GT },
          { val: "6" },
        ]),
      ).toBe(false);
    });
  });
});
