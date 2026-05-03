import { type BoardLike, forEachEquation } from "@/services/board/grid";
import {
  evaluateExpression,
  OP_DIV,
  OP_MINUS,
  OP_MULT,
  OP_PLUS,
  REL_EQ,
  REL_GT,
  REL_LT,
} from "@/services/math";

type FormulaRun = {
  keys: string[];
};

type BoardValidationReason =
  | { code: "boardEmpty" }
  | { code: "noFormula" }
  | { code: "noCrossing" }
  | { code: "invalidFormula"; formula: string };

type BoardValidation = { valid: true } | { valid: false; reason: BoardValidationReason };

export const analyzeBoard = (board: BoardLike): BoardValidation => {
  const placedKeys = Object.keys(board);
  if (placedKeys.length === 0) return { valid: false, reason: { code: "boardEmpty" } };

  const trueFormulas: FormulaRun[] = [];
  const invalidFormulas: FormulaRun[] = [];
  let invalidFormula: string | null = null;
  const isRelation = (token: string) => token === REL_EQ || token === REL_LT || token === REL_GT;
  const isOperator = (token: string) =>
    token === OP_PLUS || token === OP_MINUS || token === OP_MULT || token === OP_DIV;

  const classifyFormula = (word: { val: string; key: string }[]) => {
    const tokens = word.map((item) => item.val);
    const relationIndices = tokens.flatMap((token, index) => (isRelation(token) ? [index] : []));
    const hasOperator = tokens.some((token) => isOperator(token));
    const firstRelationIndex = relationIndices[0];
    const secondRelationIndex = relationIndices[1];

    if (!hasOperator || relationIndices.length === 0) return "ignore" as const;

    const firstRelation = relationIndices[0];
    const lastRelation = relationIndices.at(-1);
    if (firstRelation === undefined || lastRelation === undefined) return "ignore" as const;

    const isAllEquals = relationIndices.every((index) => tokens[index] === REL_EQ);
    if (isAllEquals) {
      if (firstRelation === 0 || lastRelation === tokens.length - 1) return "ignore" as const;

      const values: number[] = [];
      let start = 0;
      for (const relationIndex of relationIndices) {
        const segment = tokens.slice(start, relationIndex).join("");
        const value = evaluateExpression(segment);
        if (value === null) return "ignore" as const;
        values.push(value);
        start = relationIndex + 1;
      }

      const finalSegment = tokens.slice(start).join("");
      const finalValue = evaluateExpression(finalSegment);
      if (finalValue === null) return "ignore" as const;
      values.push(finalValue);

      const base = values[0];
      if (base === undefined) return "ignore" as const;
      if (values.some((value) => Math.abs(value - base) >= 0.0001)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }

      return { status: "valid" as const };
    }

    if (
      relationIndices.length === 1 ||
      (relationIndices.length === 2 &&
        firstRelationIndex !== undefined &&
        secondRelationIndex !== undefined &&
        tokens[firstRelationIndex] === REL_LT &&
        tokens[secondRelationIndex] === REL_GT &&
        secondRelationIndex === firstRelationIndex + 1)
    ) {
      if (firstRelation === 0 || lastRelation === tokens.length - 1) return "ignore" as const;

      const leftSide = tokens.slice(0, firstRelation).join("");
      const rightSide = tokens.slice(lastRelation + 1).join("");
      const leftVal = evaluateExpression(leftSide);
      const rightVal = evaluateExpression(rightSide);
      if (leftVal === null || rightVal === null) return "ignore" as const;

      if (
        relationIndices.length === 2 &&
        firstRelationIndex !== undefined &&
        secondRelationIndex !== undefined &&
        tokens[firstRelationIndex] === REL_LT &&
        tokens[secondRelationIndex] === REL_GT
      ) {
        if (Math.abs(leftVal - rightVal) < 0.0001) {
          return { status: "invalid" as const, formula: tokens.join("") };
        }
        return { status: "valid" as const };
      }

      const relation = tokens[firstRelation];
      if (relation === REL_LT && !(leftVal < rightVal)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }
      if (relation === REL_GT && !(leftVal > rightVal)) {
        return { status: "invalid" as const, formula: tokens.join("") };
      }

      return { status: "valid" as const };
    }

    return "ignore" as const;
  };

  forEachEquation(
    placedKeys,
    (key) => board[key],
    (word) => {
      const result = classifyFormula(word);
      if (result === "ignore") return;

      if (result.status === "invalid") {
        invalidFormula = result.formula;
        invalidFormulas.push({ keys: word.map((item) => item.key) });
        return;
      }

      trueFormulas.push({ keys: word.map((item) => item.key) });
    },
  );

  if (trueFormulas.length === 0) {
    return { valid: false, reason: { code: "noFormula" } };
  }

  if (trueFormulas.length < 2) {
    return { valid: false, reason: { code: "noCrossing" } };
  }

  const trueTileKeys = new Set<string>();
  for (const formula of trueFormulas) {
    for (const key of formula.keys) trueTileKeys.add(key);
  }

  const hasIsolatedInvalidFormula = invalidFormulas.some((formula) =>
    formula.keys.every((key) => !trueTileKeys.has(key)),
  );
  if (hasIsolatedInvalidFormula && invalidFormula) {
    return { valid: false, reason: { code: "invalidFormula", formula: invalidFormula } };
  }

  return { valid: true };
};

export const validateBoard = (board: BoardLike): BoardValidation => analyzeBoard(board);
