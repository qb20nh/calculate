import {
	OP_DIV,
	OP_MINUS,
	OP_MULT,
	OP_PLUS,
	REL_EQ,
	REL_GT,
	REL_LT,
	type TileData,
	generateValidStatement,
	getHashSeed,
	isValidEquation,
	xoshiro128pp,
} from "./math";

interface Cell {
	val: string;
	type: "val" | "op" | "rel";
}

interface Grid {
	[key: string]: Cell;
}

export const getGridBounds = (keys: string[]) => {
	let minR = Number.POSITIVE_INFINITY;
	let maxR = Number.NEGATIVE_INFINITY;
	let minC = Number.POSITIVE_INFINITY;
	let maxC = Number.NEGATIVE_INFINITY;
	for (const k of keys) {
		const [r, c] = k.split(",").map(Number);
		minR = Math.min(minR, r);
		maxR = Math.max(maxR, r);
		minC = Math.min(minC, c);
		maxC = Math.max(maxC, c);
	}
	return { minR, maxR, minC, maxC };
};

const forEachEquation = (
	keys: string[],
	getTile: (k: string) => { val: string } | undefined,
	callback: (word: { val: string; key: string }[]) => void,
) => {
	const { minR, maxR, minC, maxC } = getGridBounds(keys);

	const scan = (
		outerStart: number,
		outerEnd: number,
		innerStart: number,
		innerEnd: number,
		isHoriz: boolean,
	) => {
		for (let o = outerStart; o <= outerEnd; o++) {
			let word: { val: string; key: string }[] = [];
			for (let i = innerStart; i <= innerEnd + 1; i++) {
				const k = isHoriz ? `${o},${i}` : `${i},${o}`;
				const tile = getTile(k);
				if (tile) {
					word.push({ ...tile, key: k });
				} else {
					if (word.length > 0) callback(word);
					word = [];
				}
			}
		}
	};

	scan(minR, maxR, minC, maxC, true); // Horizontal
	scan(minC, maxC, minR, maxR, false); // Vertical
};

interface Equation {
	cells: string[];
	dx: number;
	dy: number;
}

const placeEquation = (grid: Grid, equations: Equation[], prng: () => number) => {
	for (let attempt = 0; attempt < 50; attempt++) {
		const stmt = generateValidStatement(prng);

		const possibleIntersections: { k: string; idx: number }[] = [];
		for (const k in grid) {
			const cellVal = String(grid[k].val);
			for (let i = 0; i < stmt.length; i++) {
				if (stmt[i] === cellVal) {
					possibleIntersections.push({ k, idx: i });
				}
			}
		}

		possibleIntersections.sort(() => prng() - 0.5);

		for (const match of possibleIntersections) {
			const [r, c] = match.k.split(",").map(Number);

			const hasHoriz = equations.some((eq) => eq.cells.includes(match.k) && eq.dx === 1);
			const hasVert = equations.some((eq) => eq.cells.includes(match.k) && eq.dy === 1);

			const dirs = [];
			if (!hasHoriz) dirs.push({ dx: 1, dy: 0 });
			if (!hasVert) dirs.push({ dx: 0, dy: 1 });
			dirs.sort(() => prng() - 0.5);

			for (const dir of dirs) {
				const startR = r - match.idx * dir.dy;
				const startC = c - match.idx * dir.dx;

				const cells: string[] = [];
				let collision = false;
				for (let i = 0; i < stmt.length; i++) {
					const cr = startR + i * dir.dy;
					const cc = startC + i * dir.dx;
					const ck = `${cr},${cc}`;
					cells.push(ck);

					if (i === match.idx) {
						if (ck !== match.k) collision = true;
					} else {
						if (grid[ck]) {
							collision = true;
							break;
						}
						const neighbors = [
							`${cr + 1},${cc}`,
							`${cr - 1},${cc}`,
							`${cr},${cc + 1}`,
							`${cr},${cc - 1}`,
						];
						for (const nk of neighbors) {
							if (grid[nk] && nk !== match.k) {
								let inNewEq = false;
								for (let j = 0; j < stmt.length; j++) {
									if (`${startR + j * dir.dy},${startC + j * dir.dx}` === nk) inNewEq = true;
								}
								if (!inNewEq) {
									collision = true;
									break;
								}
							}
						}
					}
					if (collision) break;
				}

				if (!collision) {
					let { minR, maxR, minC, maxC } = getGridBounds(Object.keys(grid));
					for (const k of cells) {
						const [cr, cc] = k.split(",").map(Number);
						minR = Math.min(minR, cr);
						maxR = Math.max(maxR, cr);
						minC = Math.min(minC, cc);
						maxC = Math.max(maxC, cc);
					}
					if (maxR - minR + 1 > 10 || maxC - minC + 1 > 10) {
						collision = true;
					}
				}

				if (!collision) {
					for (let i = 0; i < stmt.length; i++) {
						const char = stmt[i];
						let type: "val" | "op" | "rel" = "val";
						if ([OP_PLUS, OP_MINUS, OP_MULT, OP_DIV].includes(char)) type = "op";
						if ([REL_EQ, REL_LT, REL_GT].includes(char)) type = "rel";
						grid[cells[i]] = { type, val: char };
					}
					equations.push({ cells, dx: dir.dx, dy: dir.dy });
					return true;
				}
			}
		}
	}
	return false;
};

export const generateGame = (stage: number, difficulty: string) => {
	const seedStr = `${difficulty}_${stage}`;
	const prng = xoshiro128pp(getHashSeed(seedStr));

	let diffPercent: number;
	let minInv: number;
	let maxInv: number;
	if (difficulty === "Easy") {
		diffPercent = 0.6;
		minInv = 5;
		maxInv = 7;
	} else if (difficulty === "Medium") {
		diffPercent = 0.4;
		minInv = 10;
		maxInv = 14;
	} else {
		diffPercent = 0.2;
		minInv = 15;
		maxInv = 21;
	}

	const targetInv = minInv + Math.floor(prng() * (maxInv - minInv + 1));
	const targetTotalTiles = Math.ceil(targetInv / (1 - diffPercent));

	let bestGrid: Grid | null = null;

	for (let attempt = 0; attempt < 30; attempt++) {
		const grid: Grid = {};
		const equations: Equation[] = [];
		const stmt = generateValidStatement(prng);

		for (let i = 0; i < stmt.length; i++) {
			const char = stmt[i];
			let type: "val" | "op" | "rel" = "val";
			if ([OP_PLUS, OP_MINUS, OP_MULT, OP_DIV].includes(char)) type = "op";
			if ([REL_EQ, REL_LT, REL_GT].includes(char)) type = "rel";
			grid[`0,${i}`] = { type, val: char };
		}
		equations.push({ dx: 1, dy: 0, cells: stmt.map((_, i) => `0,${i}`) });

		let fails = 0;
		while (Object.keys(grid).length < targetTotalTiles && fails < 40) {
			if (!placeEquation(grid, equations, prng)) fails++;
		}

		if (!bestGrid || Object.keys(grid).length > Object.keys(bestGrid).length) {
			bestGrid = grid;
		}

		if (Object.keys(grid).length >= targetTotalTiles) {
			break;
		}
	}

	if (!bestGrid) {
		bestGrid = {
			"0,0": { type: "val", val: "2" },
			"0,1": { type: "op", val: OP_PLUS },
			"0,2": { type: "val", val: "3" },
			"0,3": { type: "rel", val: REL_EQ },
			"0,4": { type: "val", val: "5" },
		};
	}

	const board: { [key: string]: TileData } = {};
	const bank: TileData[] = [];

	const totalTiles = Object.keys(bestGrid).length;
	let numGivens = Math.round(totalTiles * diffPercent);
	let numInventory = totalTiles - numGivens;

	if (numInventory < minInv) {
		numInventory = Math.min(totalTiles - 1, minInv);
		numGivens = totalTiles - numInventory;
	} else if (numInventory > maxInv) {
		numInventory = maxInv;
		numGivens = totalTiles - numInventory;
	}
	if (numGivens < 0) numGivens = 0;

	const { minR, maxR, minC, maxC } = getGridBounds(Object.keys(bestGrid));

	const allKeys = Object.keys(bestGrid);
	let givenKeys = new Set<string>();
	let safeGivens = false;
	let givenAttempts = 0;

	while (!safeGivens && givenAttempts < 200) {
		givenAttempts++;
		allKeys.sort(() => prng() - 0.5);
		givenKeys = new Set(allKeys.slice(0, numGivens));

		const tempBoard: Grid = {};
		for (const k of givenKeys) tempBoard[k] = bestGrid[k];

		let foundTrueStatement = false;
		forEachEquation(
			Object.keys(tempBoard),
			(k) => tempBoard[k],
			(word) => {
				if (word.length >= 3 && isValidEquation(word)) foundTrueStatement = true;
			},
		);

		if (!foundTrueStatement) {
			safeGivens = true;
		}
	}

	for (const k in bestGrid) {
		const cell = bestGrid[k];
		if (givenKeys.has(k)) {
			board[k] = { id: `g_${k}`, ...cell, isGiven: true };
		} else {
			bank.push({ id: `b_${k}`, val: cell.val, type: cell.type });
		}
	}

	bank.sort((a, b) => {
		const w = (t: TileData) => (t.type === "val" ? 1 : t.type === "op" ? 2 : 3);
		if (w(a) !== w(b)) return w(a) - w(b);
		return String(a.val).localeCompare(String(b.val));
	});

	return { board, bank, initialBankSize: bank.length, status: "playing" };
};

export const validateBoard = (board: { [key: string]: TileData }) => {
	const placedKeys = Object.keys(board);
	if (placedKeys.length === 0) return { valid: false, reason: "Board is empty." };

	const visited = new Set<string>();
	const queue = [placedKeys[0]];
	visited.add(placedKeys[0]);

	while (queue.length > 0) {
		const item = queue.shift();
		if (!item) continue;
		const [r, c] = item.split(",").map(Number);
		const neighbors = [`${r + 1},${c}`, `${r - 1},${c}`, `${r},${c + 1}`, `${r},${c - 1}`];

		for (const nk of neighbors) {
			if (board[nk] && !visited.has(nk)) {
				visited.add(nk);
				queue.push(nk);
			}
		}
	}

	if (visited.size !== placedKeys.length)
		return { valid: false, reason: "All tiles must be connected together." };

	const { minR, maxR, minC, maxC } = getGridBounds(placedKeys);

	const validTiles = new Set<string>();
	let equationsCount = 0;

	forEachEquation(
		placedKeys,
		(k) => board[k],
		(word) => {
			if (word.length >= 3 && isValidEquation(word)) {
				equationsCount++;
				for (const t of word) {
					validTiles.add(t.key);
				}
			}
		},
	);

	if (equationsCount === 0)
		return { valid: false, reason: "No valid mathematical equations found." };

	for (const k of placedKeys) {
		if (!validTiles.has(k)) {
			return { valid: false, reason: "Some tiles don't form a correct equation." };
		}
	}

	return { valid: true };
};
