// --- PRNG & Hashing ---
export const getHashSeed = (str: string) => {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 16777619);
	}
	return h >>> 0;
};

export function mulberry32(initialSeed: number) {
	let a = initialSeed;
	return function () {
		let t = (a += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// --- Math Logic Helpers ---
export const generateValidStatement = (prng: () => number) => {
	const ops = ['+', '-', '*', '/'];

	let attempts = 0;
	while (attempts < 1000) {
		attempts++;
		const op = ops[Math.floor(prng() * ops.length)];

		const relRoll = prng();
		let rel = '=';
		if (relRoll > 0.75) {
			if (relRoll > 0.91) rel = '<>';
			else if (relRoll > 0.83) rel = '>';
			else rel = '<';
		}

		let A: number, B: number, val: number;

		if (op === '+') {
			A = 1 + Math.floor(prng() * 40);
			B = 1 + Math.floor(prng() * 40);
			val = A + B;
		} else if (op === '-') {
			B = 1 + Math.floor(prng() * 40);
			A = B + 1 + Math.floor(prng() * 40);
			val = A - B;
		} else if (op === '*') {
			A = 2 + Math.floor(prng() * 8);
			B = 2 + Math.floor(prng() * 9);
			val = A * B;
		} else if (op === '/') {
			B = 2 + Math.floor(prng() * 8);
			val = 2 + Math.floor(prng() * 9);
			A = B * val;
		} else {
			// Fallback
			continue;
		}

		let C = val;
		if (rel === '<') {
			C = val + 1 + Math.floor(prng() * 15);
		} else if (rel === '>') {
			if (val <= 0) continue;
			C = Math.floor(prng() * val);
		} else if (rel === '<>') {
			C = val + (prng() > 0.5 ? 1 : -1) * (1 + Math.floor(prng() * 10));
			if (C < 0) C = val + 1;
		}

		if (A >= 100 || B >= 100 || C >= 100) continue;

		const tokens: string[] = [];
		tokens.push(...String(A).split(''));
		tokens.push(op);
		tokens.push(...String(B).split(''));

		if (rel === '<>') {
			tokens.push('<');
			tokens.push('>');
		} else {
			tokens.push(rel);
		}

		tokens.push(...String(C).split(''));

		if (tokens.length >= 5 && tokens.length <= 10) {
			return tokens;
		}
	}
	return ['1', '+', '2', '=', '3'];
};

export const evaluateExpression = (str: string) => {
	if (str.length === 0) return null;
	if (/[+\-*/]{2,}/.test(str)) return null;
	if (/^[+\-*/]/.test(str)) return null;
	if (/[+\-*/]$/.test(str)) return null;
	if (!/^[0-9+\-*/]+$/.test(str)) return null;
	if (/(^|[+\-*/])0\d+/.test(str)) return null;

	const tokens = str.match(/\d+|[+\-*/]/g);
	if (!tokens) return null;

	const pass1: (number | string)[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t === '*' || t === '/') {
			const left = pass1.pop() as number;
			const right = Number(tokens[++i]);
			if (t === '*') {
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
		if (op === '+') res += right;
		if (op === '-') res -= right;
	}

	if (typeof res !== 'number' || !Number.isFinite(res)) return null;
	return res;
};

export interface TileData {
	val: string;
	type: 'val' | 'op' | 'rel';
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
		if (t === '=' || t === '<' || t === '>') {
			if (relType !== null) {
				if (relType === '<' && t === '>' && i === relEnd + 1) {
					relType = '<>';
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

	const leftSide = tokens.slice(0, relStart).join('');
	const rightSide = tokens.slice(relEnd + 1).join('');

	const leftVal = evaluateExpression(leftSide);
	const rightVal = evaluateExpression(rightSide);

	if (leftVal === null || rightVal === null) return false;

	if (relType === '=') return Math.abs(leftVal - rightVal) < 0.0001;
	if (relType === '<') return leftVal < rightVal;
	if (relType === '>') return leftVal > rightVal;
	if (relType === '<>') return Math.abs(leftVal - rightVal) >= 0.0001;

	return false;
};
