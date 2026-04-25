import { generateGame, validateBoard } from "@/services/board";
import { OP_PLUS, REL_EQ } from "@/services/math";
import { describe, expect, it } from "vitest";

describe("board service", () => {
	it("should generate a playable game for all difficulties", () => {
		const difficulties = ["Easy", "Medium", "Hard"];
		for (const diff of difficulties) {
			for (let stage = 1; stage <= 5; stage++) {
				const game = generateGame(stage, diff);
				expect(game.status).toBe("playing");
				expect(Object.keys(game.board).length).toBeGreaterThan(0);
				expect(game.bank.length).toBeGreaterThan(0);
			}
		}
	});

	const createTestBoard = (overrides: Record<string, string> = {}) => {
		const base = {
			"0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
			"0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
			"0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
			"0,3": { id: "4", val: REL_EQ, type: "rel" as const, isGiven: true },
			"0,4": { id: "5", val: "5", type: "val" as const, isGiven: true },
		};
		for (const [key, val] of Object.entries(overrides)) {
			if (base[key as keyof typeof base]) {
				(base[key as keyof typeof base] as { val: string }).val = val;
			}
		}
		return base;
	};

	it("should validate a correct board", () => {
		const board = createTestBoard();
		expect(validateBoard(board).valid).toBe(true);
	});

	it("should invalidate an incorrect board", () => {
		const board = createTestBoard({ "0,4": "6" });
		const result = validateBoard(board);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("equation");
	});

	it("should invalidate a disconnected board", () => {
		const board = {
			"0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
			"0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
			"0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
			"5,5": { id: "4", val: "1", type: "val" as const, isGiven: true },
			"5,6": { id: "5", val: REL_EQ, type: "rel" as const, isGiven: true },
			"5,7": { id: "6", val: "1", type: "val" as const, isGiven: true },
		};
		const result = validateBoard(board);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("connected");
	});

	it("should invalidate an empty board", () => {
		expect(validateBoard({}).valid).toBe(false);
	});

	it("should invalidate a board with no valid equations", () => {
		const board = {
			"0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
			"0,1": { id: "2", val: OP_PLUS, type: "op" as const, isGiven: true },
			"0,2": { id: "3", val: "3", type: "val" as const, isGiven: true },
		};
		const result = validateBoard(board);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("No valid mathematical equations");
	});

	it("should invalidate a board where some tiles are not part of any equation", () => {
		const board = {
			"0,0": { id: "1", val: "2", type: "val" as const, isGiven: true },
			"0,1": { id: "2", val: REL_EQ, type: "rel" as const, isGiven: true },
			"0,2": { id: "3", val: "2", type: "val" as const, isGiven: true },
			"1,0": { id: "4", val: "9", type: "val" as const, isGiven: true }, // Extra tile
		};
		const result = validateBoard(board);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("form a correct equation");
	});
});
