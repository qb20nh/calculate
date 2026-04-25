import { Game } from "@/components/Game";
import * as BoardService from "@/services/board";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/board", async () => {
	const actual = await vi.importActual<typeof BoardService>("@/services/board");
	return {
		...actual,
		generateGame: vi.fn(actual.generateGame),
		validateBoard: vi.fn(actual.validateBoard),
	};
});

describe("Game", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should show loading state initially", () => {
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		expect(screen.getByText("Generating Puzzle...")).toBeDefined();
	});

	it("should render the board after loading", async () => {
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		// Fast-forward simulation timer in Game.tsx (500ms)
		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		await waitFor(() => {
			expect(screen.queryByText("Generating Puzzle...")).toBeNull();
		});

		expect(screen.getByText("Easy — Stage 1")).toBeDefined();
	});

	it("should handle tile selection and placement", async () => {
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		// Wait for tiles to appear in bank
		let bankTiles: HTMLElement[] = [];
		await waitFor(() => {
			bankTiles = screen
				.getAllByRole("button")
				.filter(
					(b) =>
						b.className.includes("tile-val") ||
						b.className.includes("tile-op") ||
						b.className.includes("tile-rel"),
				);
			expect(bankTiles.length).toBeGreaterThan(0);
		});

		// Find a tile in the bank and click it
		fireEvent.click(bankTiles[0]);

		// Wait for it to be selected
		await waitFor(() => {
			expect(bankTiles[0].className).toContain("ring-4");
		});

		// Find a fringe slot and click it
		const fringeSlots = screen.getAllByLabelText("Place tile here");
		fireEvent.click(fringeSlots[0]);

		// Selection should be cleared. Re-query the tile if it still exists.
		await waitFor(() => {
			const updatedTiles = screen
				.getAllByRole("button")
				.filter(
					(b) =>
						b.className.includes("tile-val") ||
						b.className.includes("tile-op") ||
						b.className.includes("tile-rel"),
				);
			// If bankTiles[0] was removed, it should not be in the bank.
			// If it was swapped, its id would be different.
			const isStillSelected = updatedTiles.some((t) => t.className.includes("ring-4"));
			expect(isStillSelected).toBe(false);
		});
	});

	it("should handle reset", async () => {
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		await waitFor(() => {
			expect(screen.getByText("Easy — Stage 1")).toBeDefined();
		});

		const resetButton = screen.getByLabelText("Reset Stage");
		fireEvent.click(resetButton);

		expect(screen.getByText("Easy — Stage 1")).toBeDefined();
	});

	it("should handle back button", async () => {
		const onBack = vi.fn();
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={onBack} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		await waitFor(() => {
			expect(screen.getByLabelText("Back")).toBeDefined();
		});

		const backButton = screen.getByLabelText("Back");
		fireEvent.click(backButton);

		expect(onBack).toHaveBeenCalled();
	});

	it("should not select given tiles", async () => {
		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		let givenTiles: HTMLElement[] = [];
		await waitFor(() => {
			givenTiles = screen.getAllByRole("button").filter((b) => b.className.includes("tile-given"));
			expect(givenTiles.length).toBeGreaterThan(0);
		});

		fireEvent.click(givenTiles[0]);
		expect(givenTiles[0].className).not.toContain("ring-4");
	});

	it("should show toast for invalid board", async () => {
		const mockGame = {
			board: {
				"0,0": { id: "g1", val: "1", type: "val", isGiven: true },
				"0,1": { id: "g2", val: "=", type: "rel", isGiven: true },
			},
			bank: [{ id: "b1", val: "2", type: "val" }], // 1=2 is invalid
			initialBankSize: 1,
			status: "playing",
		};
		vi.mocked(BoardService.generateGame).mockReturnValue(
			mockGame as unknown as ReturnType<typeof BoardService.generateGame>,
		);
		vi.mocked(BoardService.validateBoard).mockReturnValue({
			valid: false,
			reason: "Invalid equation",
		});

		render(
			<Game difficulty="Easy" stage={1} onWin={vi.fn()} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		await waitFor(() => {
			expect(screen.queryByText("Generating Puzzle...")).toBeNull();
		});

		// Place the tile
		fireEvent.click(screen.getByText("2", { selector: ".tile-val" }));
		fireEvent.click(screen.getAllByLabelText("Place tile here")[0]);

		// Should show validation error toast
		await waitFor(
			() => {
				expect(screen.getByText("Invalid equation")).toBeDefined();
			},
			{ timeout: 3000 },
		);
	});

	it("should show win screen when board is solved", async () => {
		const mockGame = {
			board: {
				"0,0": { id: "g1", val: "1", type: "val", isGiven: true },
				"0,1": { id: "g2", val: "=", type: "rel", isGiven: true },
			},
			bank: [{ id: "b1", val: "1", type: "val" }],
			initialBankSize: 1,
			status: "playing",
		};
		vi.mocked(BoardService.generateGame).mockReturnValue(
			mockGame as unknown as ReturnType<typeof BoardService.generateGame>,
		);
		vi.mocked(BoardService.validateBoard).mockReturnValue({ valid: true });

		const onWin = vi.fn();
		render(
			<Game difficulty="Easy" stage={1} onWin={onWin} onBack={vi.fn()} onStateChange={vi.fn()} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(600);
		});

		await waitFor(() => {
			expect(screen.queryByText("Generating Puzzle...")).toBeNull();
		});

		// Select and place
		fireEvent.click(screen.getByText("1", { selector: ".tile-val" }));
		fireEvent.click(screen.getAllByLabelText("Place tile here")[0]);

		// Win screen should appear
		await waitFor(() => {
			expect(screen.getByText("Perfect!")).toBeDefined();
		});

		expect(onWin).toHaveBeenCalled();

		fireEvent.click(screen.getByText("Continue"));
		await waitFor(() => {
			expect(screen.queryByText("Perfect!")).toBeNull();
		});
	});
});
