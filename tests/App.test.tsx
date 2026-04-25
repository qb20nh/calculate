import { App } from "@/index";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("App", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		const storage: Record<string, string> = {};
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => storage[key] || null,
			setItem: (key: string, value: string) => {
				storage[key] = value;
			},
			removeItem: (key: string) => {
				delete storage[key];
			},
			clear: () => {
				for (const key in storage) delete storage[key];
			},
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should render main menu initially", () => {
		render(<App />);
		expect(screen.getByText("Math")).toBeDefined();
	});

	it("should navigate to game when starting a level", async () => {
		render(<App />);

		fireEvent.click(screen.getByText("Easy"));

		// Should show loading
		expect(screen.getByText("Generating Puzzle...")).toBeDefined();

		// Fast-forward
		await vi.advanceTimersByTimeAsync(600);

		await waitFor(() => {
			expect(screen.getByText("Easy — Stage 1")).toBeDefined();
		});
	});

	it("should navigate back to menu", async () => {
		render(<App />);

		fireEvent.click(screen.getByText("Easy"));
		await vi.advanceTimersByTimeAsync(600);

		await waitFor(() => {
			expect(screen.getByLabelText("Back")).toBeDefined();
		});

		fireEvent.click(screen.getByLabelText("Back"));

		expect(screen.getByText("Math")).toBeDefined();
	});
});
