// --- PRNG & Hashing ---
export const getHashSeed = (str: string) => {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 16777619);
	}
	return h >>> 0;
};

export function xoshiro128pp(seed: number) {
	let s0 = seed >>> 0;
	let s1 = Math.imul(s0, 0x6d2b79f5) >>> 0;
	let s2 = Math.imul(s1, 0x6d2b79f5) >>> 0;
	let s3 = Math.imul(s2, 0x6d2b79f5) >>> 0;

	return () => {
		const result = ((((s0 + s3) << 7) | ((s0 + s3) >>> 25)) + s0) >>> 0;
		const t = s1 << 9;

		s2 ^= s0;
		s3 ^= s1;
		s1 ^= s2;
		s0 ^= s3;

		s2 ^= t;
		s3 = (s3 << 11) | (s3 >>> 21);

		return result / 4294967296;
	};
}

// --- Math Symbols ---
export const OP_PLUS = "+";
export const OP_MINUS = "−"; // U+2212
export const OP_MULT = "×"; // U+00D7
export const OP_DIV = "÷"; // U+00F7

export const REL_EQ = "=";
export const REL_LT = "<";
export const REL_GT = ">";

// --- Math Logic Helpers ---
export const generateValidStatement = (prng: () => number) => {
	const ops = [OP_PLUS, OP_MINUS, OP_MULT, OP_DIV];

	let attempts = 0;
	while (attempts < 1000) {
		attempts++;
		const op = ops[Math.floor(prng() * ops.length)];

		const relRoll = prng();
		let rel = REL_EQ;
		if (relRoll > 0.75) {
			if (relRoll > 0.91)
				rel = "<>"; // Special case for not-equals formed by < and >
			else if (relRoll > 0.83) rel = REL_GT;
			else rel = REL_LT;
		}

		let A: number;
		let B: number;
		let val: number;

		if (op === OP_PLUS) {
			A = 1 + Math.floor(prng() * 40);
			B = 1 + Math.floor(prng() * 40);
			val = A + B;
		} else if (op === OP_MINUS) {
			B = 1 + Math.floor(prng() * 40);
			A = B + 1 + Math.floor(prng() * 40);
			val = A - B;
		} else if (op === OP_MULT) {
			A = 2 + Math.floor(prng() * 8);
			B = 2 + Math.floor(prng() * 9);
			val = A * B;
		} else if (op === OP_DIV) {
			B = 2 + Math.floor(prng() * 8);
			val = 2 + Math.floor(prng() * 9);
			A = B * val;
		} else {
			// Fallback
			continue;
		}

		let C = val;
		if (rel === REL_LT) {
			C = val + 1 + Math.floor(prng() * 15);
		} else if (rel === REL_GT) {
			if (val <= 0) continue;
			C = Math.floor(prng() * val);
		} else if (rel === "<>") {
			C = val + (prng() > 0.5 ? 1 : -1) * (1 + Math.floor(prng() * 10));
			if (C < 0) C = val + 1;
		}

		if (A >= 100 || B >= 100 || C >= 100) continue;

		const tokens: string[] = [];
		tokens.push(...String(A).split(""));
		tokens.push(op);
		tokens.push(...String(B).split(""));

		if (rel === "<>") {
			tokens.push(REL_LT);
			tokens.push(REL_GT);
		} else {
			tokens.push(rel);
		}

		tokens.push(...String(C).split(""));

		if (tokens.length >= 5 && tokens.length <= 10) {
			return tokens;
		}
	}
	return ["1", OP_PLUS, "2", REL_EQ, "3"];
};

export const evaluateExpression = (str: string) => {
	if (str.length === 0) return null;

	// Map Unicode symbols to standard ASCII operators for evaluation
	const normalized = str
		.replace(new RegExp(OP_MINUS, "g"), "-")
		.replace(new RegExp(OP_MULT, "g"), "*")
		.replace(new RegExp(OP_DIV, "g"), "/");

	if (/[+\-*/]{2,}/.test(normalized)) return null;
	if (/^[+\-*/]/.test(normalized)) return null;
	if (/[+\-*/]$/.test(normalized)) return null;
	if (!/^[0-9+\-*/]+$/.test(normalized)) return null;
	if (/(^|[+\-*/])0\d+/.test(normalized)) return null;

	const tokens = normalized.match(/\d+|[+\-*/]/g);
	if (!tokens) return null;

	const pass1: (number | string)[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t === "*" || t === "/") {
			const left = pass1.pop() as number;
			const right = Number(tokens[++i]);
			if (t === "*") {
				pass1.push(left * right);
			} else {
				if (right === 0) return null;
				if (left % right !== 0) return null;
				pass1.push(left / right);
			}
		} else if (/\d+/.test(t)) {
			pass1.push(Number(t));
		} else {
			pass1.push(t);
		}
	}

	let res = pass1[0] as number;
	for (let i = 1; i < pass1.length; i += 2) {
		const op = pass1[i];
		const right = pass1[i + 1] as number;
		if (op === "+") res += right;
		if (op === "-") res -= right;
	}

	if (typeof res !== "number" || !Number.isFinite(res)) return null;
	return res;
};

export interface TileData {
	val: string;
	type: "val" | "op" | "rel";
	isGiven?: boolean;
	id: string;
}

export const isValidEquation = (wordTiles: { val: string }[]) => {
	const tokens = wordTiles.map((t) => t.val);

	let relType: string | null = null;
	let relStart = -1;
	let relEnd = -1;

	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t === REL_EQ || t === REL_LT || t === REL_GT) {
			if (relType !== null) {
				if (relType === REL_LT && t === REL_GT && i === relEnd + 1) {
					relType = "<>";
					relEnd = i;
					continue;
				}
				return false;
			}
			relType = t;
			relStart = i;
			relEnd = i;
		}
	}

	if (relType === null) return false;
	if (relStart === 0 || relEnd === tokens.length - 1) return false;

	const leftSide = tokens.slice(0, relStart).join("");
	const rightSide = tokens.slice(relEnd + 1).join("");

	const leftVal = evaluateExpression(leftSide);
	const rightVal = evaluateExpression(rightSide);

	if (leftVal === null || rightVal === null) return false;

	if (relType === REL_EQ) return Math.abs(leftVal - rightVal) < 0.0001;
	if (relType === REL_LT) return leftVal < rightVal;
	if (relType === REL_GT) return leftVal > rightVal;
	if (relType === "<>") return Math.abs(leftVal - rightVal) >= 0.0001;

	return false;
};
