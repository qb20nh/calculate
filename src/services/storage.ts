import type { TileData } from "./math";

export interface GameState {
	board: { [key: string]: TileData };
	bank: TileData[];
	initialBankSize: number;
	status: "playing" | "won";
	difficulty: string;
	stage: number;
	solvedAcknowledged?: boolean;
}

export interface Progress {
	[difficulty: string]: {
		current: number;
		max: number;
	};
}

const STORAGE_KEY_PROGRESS = "math_scrabble_progress";
const STORAGE_KEY_STATE = "math_scrabble_state";

export const saveProgress = (progress: Progress) => {
	localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
};

export const loadProgress = (): Progress => {
	const saved = localStorage.getItem(STORAGE_KEY_PROGRESS);
	if (saved) {
		return JSON.parse(saved);
	}
	return {
		Easy: { current: 1, max: 1 },
		Medium: { current: 1, max: 1 },
		Hard: { current: 1, max: 1 },
	};
};

export const saveGameState = (state: GameState | null) => {
	if (state) {
		localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
	} else {
		localStorage.removeItem(STORAGE_KEY_STATE);
	}
};

export const loadGameState = (): GameState | null => {
	const saved = localStorage.getItem(STORAGE_KEY_STATE);
	if (saved) {
		return JSON.parse(saved);
	}
	return null;
};
