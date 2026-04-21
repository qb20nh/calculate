import { ValidationResult, TileItem } from './types';
import { SORT_ORDER } from '../constants/gameData';

const parseStatement = (str: string): { expressions: string[], comparators: string[] } => {
    const comparators: string[] = [];
    const expressions: string[] = [];
    let currentExpr = "";

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '<' && str[i + 1] === '>') {
            expressions.push(currentExpr);
            comparators.push('<>');
            currentExpr = "";
            i++;
        } else if (['=', '<', '>'].includes(str[i])) {
            expressions.push(currentExpr);
            comparators.push(str[i]);
            currentExpr = "";
        } else {
            currentExpr += str[i];
        }
    }
    expressions.push(currentExpr);
    return { expressions, comparators };
};

export const isValidEquation = (str: string): ValidationResult => {
    const { expressions, comparators } = parseStatement(str);

    if (comparators.length === 0) return { valid: false, reason: "Must contain a comparator (=, <, >, <>)." };
    if (expressions.some(e => e === "")) return { valid: false, reason: "Misplaced comparators." };

    for (let i = 0; i < comparators.length; i++) {
        const leftExpr = expressions[i];
        const rightExpr = expressions[i + 1];
        const leftHasOp = /[0-9][+−×÷]/.test(leftExpr);
        const rightHasOp = /[0-9][+−×÷]/.test(rightExpr);

        if (!leftHasOp && !rightHasOp) {
            return { valid: false, reason: `Invalid comparison: neither side of '${comparators[i]}' contains an operator.` };
        }
    }

    const values: number[] = [];
    for (const expr of expressions) {
        try {
            if (/\b0[0-9]+/.test(expr)) return { valid: false, reason: "Leading zeros not allowed." };
             
            const val = Function(`'use strict'; return (${expr.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/')})`)();
            if (!Number.isFinite(val)) return { valid: false, reason: "Invalid mathematical result (e.g., division by zero)." };
            values.push(val);
        } catch {
            return { valid: false, reason: `Invalid syntax in expression: ${expr}` };
        }
    }

    for (let i = 0; i < comparators.length; i++) {
        const left = values[i];
        const right = values[i + 1];
        const comp = comparators[i];
        if (comp === '=' && !(left === right)) return { valid: false, reason: `Mathematically false: ${left} = ${right}` };
        if (comp === '<' && !(left < right)) return { valid: false, reason: `Mathematically false: ${left} < ${right}` };
        if (comp === '>' && !(left > right)) return { valid: false, reason: `Mathematically false: ${left} > ${right}` };
        if (comp === '<>' && !(left !== right)) return { valid: false, reason: `Mathematically false: ${left} <> ${right}` };
    }

    return { valid: true };
};

export const normalizeExpr = (expr: string): string => {
    return expr.split('+').map(part => 
        part.split('×').sort().join('×')
    ).sort().join('+');
};

export const getNormalizedRelations = (statement: string): string[] => {
    const { expressions, comparators } = parseStatement(statement);

    const currentRelations: string[] = [];
    for (let i = 0; i < comparators.length; i++) {
        const left = normalizeExpr(expressions[i]);
        const right = normalizeExpr(expressions[i + 1]);
        const op = comparators[i];

        if (op === '=' || op === '<>') {
            const sorted = [left, right].sort();
            currentRelations.push(`${sorted[0]}${op}${sorted[1]}`);
        } else if (op === '>') {
            currentRelations.push(`${right}<${left}`);
        } else {
            currentRelations.push(`${left}${op}${right}`);
        }
    }
    return currentRelations;
};

export const getGroupedTiles = (tilesArray: TileItem[]): { char: string; count: number }[] => {
    const counts: Record<string, number> = {};
    tilesArray.forEach(t => counts[t.char] = (counts[t.char] || 0) + 1);
    return Object.keys(counts)
        .sort((a, b) => {
            let idxA = SORT_ORDER.indexOf(a);
            let idxB = SORT_ORDER.indexOf(b);
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        })
        .map(char => ({ char, count: counts[char] }));
};
