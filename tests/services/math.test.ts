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
    expect(evaluateExpression(`-2${OP_PLUS}3`)).toBe(1);
    expect(evaluateExpression(`2${OP_DIV}0`)).toBeNull();
    expect(evaluateExpression(`7${OP_DIV}3`)).toBeNull(); // Only integer division
    expect(evaluateExpression(`01${OP_PLUS}2`)).toBeNull(); // No leading zeros
    expect(evaluateExpression(`2${OP_PLUS}3=5`)).toBeNull(); // No relations in evaluateExpression
    expect(evaluateExpression("2a+3")).toBeNull(); // No letters
    expect(evaluateExpression("2x3")).toBeNull(); // Unknown characters
    expect(evaluateExpression(`2${OP_MULT}`)).toBeNull(); // Missing right token
    expect(evaluateExpression(`${OP_MULT}2`)).toBeNull(); // Missing left token
    expect(evaluateExpression(`7${OP_DIV}2`)).toBeNull(); // Non-integer division
    expect(evaluateExpression(`2${OP_PLUS}01`)).toBeNull(); // Leading zero on right
    expect(evaluateExpression("1e1000")).toBeNull(); // Infinity/Non-finite value
    expect(evaluateExpression("0.1+0.2")).toBeNull(); // Only integers
  });

  it("should reject non-finite numeric tokens and overflow results", () => {
    expect(evaluateExpression("9".repeat(400))).toBeNull();
    expect(evaluateExpression(`1${OP_MULT}${"9".repeat(400)}`)).toBeNull();
    expect(evaluateExpression(`${"9".repeat(308)}${OP_MULT}10`)).toBeNull();
  });

  it("should handle non-finite results in evaluateExpression", () => {
    // Force a very large number that might become non-finite if we had exponentiation,
    // but here we can just test if the check works.
    // Since we only have +, -, *, / with integers, it's hard to get Infinity unless dividing by zero.
    // Dividing by zero is already tested.
    // But we can test the value check.
    expect(evaluateExpression("999999999999999999999999999999999")).not.toBeNull();
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

  it("should not generate division with two double-digit operands", () => {
    // Check 1000 generated statements to ensure the constraint is respected
    for (let i = 0; i < 1000; i++) {
      const prng = xoshiro128pp(i);
      const tokens = generateValidStatement(prng);
      if (tokens.includes(OP_DIV)) {
        const divIdx = tokens.indexOf(OP_DIV);
        const relIdx = tokens.findIndex((t) => t === REL_EQ || t === REL_LT || t === REL_GT);
        const leftStr = tokens.slice(0, divIdx).join("");
        const rightStr = tokens.slice(divIdx + 1, relIdx).join("");

        const left = Number(leftStr);
        const right = Number(rightStr);

        if (left >= 10 && right >= 10) {
          // The constraint allows double-digit operands only if the division evaluates to 2.
          if (left / right !== 2) {
            throw new Error(
              `Division with two double-digit operands found (result is not 2): ${tokens.join("")} (${left} / ${right} = ${left / right})`,
            );
          }
        }
      }
    }
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
          { val: "10" },
          { val: OP_MINUS },
          { val: "5" },
          { val: REL_GT },
          { val: "5" },
        ]),
      ).toBe(false);
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
      expect(isValidEquation([{ val: "5" }, { val: REL_LT }, { val: REL_LT }, { val: "5" }])).toBe(
        false,
      ); // Invalid relation sequence (not <>)
      expect(isValidEquation([{ val: "5" }, { val: "INVALID" }, { val: "5" }])).toBe(false); // Invalid relation
      expect(isValidEquation([{ val: "5" }, { val: REL_EQ }, { val: "5" }])).toBe(false); // No operators
      expect(isValidEquation([{ val: REL_EQ }, { val: "1" }, { val: OP_PLUS }, { val: "1" }])).toBe(
        false,
      ); // Empty left
      expect(isValidEquation([{ val: "1" }, { val: OP_PLUS }, { val: "1" }, { val: REL_EQ }])).toBe(
        false,
      ); // Empty right
      expect(isValidEquation([{ val: "1" }, { val: "" }, { val: "1" }])).toBe(false); // Empty token
    });

    it("should cover all relRoll branches in generateValidStatement", () => {
      // Use a sequence PRNG to control opIndex and relRoll independently
      const createSequencePrng = (vals: number[]) => {
        let i = 0;
        return () => vals[i++] ?? vals[vals.length - 1] ?? 0;
      };

      // opIndex = 0 (Plus), relRoll = 0.8 (REL_LT)
      expect(generateValidStatement(createSequencePrng([0, 0.8]))).toContain(REL_LT);
      // opIndex = 0 (Plus), relRoll = 0.85 (REL_GT)
      expect(generateValidStatement(createSequencePrng([0, 0.85]))).toContain(REL_GT);
      // opIndex = 0 (Plus), relRoll = 0.95 (REL_NEQ)
      const neqTokens = generateValidStatement(createSequencePrng([0, 0.95]));
      expect(neqTokens).toContain(REL_LT);
      expect(neqTokens).toContain(REL_GT);
    });

    it("should cover applyRelation branches", () => {
      // Coverage for applyRelation branch with small base
      // Force REL_GT but with baseValue = 0 to trigger the REL_LT fallback in division
      // opIndex = 3 (Division), relRoll = 0.85 (REL_GT), right = 18 (0.85*20), result = 0
      const tokens = generateValidStatement(() => 0.85);
      expect(tokens).toContain(REL_LT); // Fallback from GT to LT
    });
  });
});
