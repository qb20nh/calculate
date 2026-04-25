import { MainMenu } from "@/components/MainMenu";
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

describe("MainMenu", () => {
	const mockProgress = {
		Easy: { current: 1, max: 5 },
		Medium: { current: 1, max: 1 },
		Hard: { current: 1, max: 1 },
	};

	it("should render difficulty options", () => {
		render(<MainMenu onStart={vi.fn()} progress={mockProgress} />);

		expect(screen.getByText("Math")).toBeDefined();
		expect(screen.getByText("Crossword")).toBeDefined();
		expect(screen.getByText("Easy")).toBeDefined();
		expect(screen.getByText("Medium")).toBeDefined();
		expect(screen.getByText("Hard")).toBeDefined();
	});

	it("should show max stage progress", () => {
		render(<MainMenu onStart={vi.fn()} progress={mockProgress} />);

		expect(screen.getByText("Max Stage: 5")).toBeDefined();
		expect(screen.getAllByText("Max Stage: 1")).toHaveLength(2);
	});

	it("should call onStart when a difficulty is clicked", () => {
		const onStart = vi.fn();
		render(<MainMenu onStart={onStart} progress={mockProgress} />);

		fireEvent.click(screen.getByText("Easy"));
		expect(onStart).toHaveBeenCalledWith("Easy");

		fireEvent.click(screen.getByText("Hard"));
		expect(onStart).toHaveBeenCalledWith("Hard");
	});
});
