import { hydrate, prerender as ssr } from "preact-iso";
import { useCallback, useEffect, useState } from "preact/hooks";
import { Game } from "./components/Game";
import { MainMenu } from "./components/MainMenu";
import {
	type GameState,
	type Progress,
	loadGameState,
	loadProgress,
	saveGameState,
	saveProgress,
} from "./services/storage";
import "./style.css";

export function App() {
	const [view, setView] = useState<"menu" | "game">("menu");
	const [difficulty, setDifficulty] = useState<string>("Medium");
	const [stage, setStage] = useState<number>(1);
	const [progress, setProgress] = useState<Progress>(loadProgress());
	const [initialGameState, setInitialGameState] = useState<GameState | null>(loadGameState());

	// Initial view determination
	useEffect(() => {
		if (initialGameState) {
			setDifficulty(initialGameState.difficulty);
			setStage(initialGameState.stage);
			setView("game");
		}
	}, [initialGameState]);

	const handleStartGame = (diff: string) => {
		const currentStage = progress[diff].current;
		setDifficulty(diff);
		setStage(currentStage);
		setInitialGameState(null);
		setView("game");
	};

	const handleWin = useCallback(
		(nextStage: number) => {
			setProgress((prev) => {
				const newProgress = {
					...prev,
					[difficulty]: {
						...prev[difficulty],
						max: Math.max(prev[difficulty].max, nextStage),
						current: nextStage,
					},
				};
				saveProgress(newProgress);
				return newProgress;
			});
			setStage(nextStage);
		},
		[difficulty],
	);

	const handleBack = () => {
		saveGameState(null);
		setView("menu");
	};

	const handleStateChange = useCallback((state: GameState) => {
		saveGameState(state);
	}, []);

	return (
		<div id="app">
			{view === "menu" ? (
				<MainMenu onStart={handleStartGame} progress={progress} />
			) : (
				<Game
					difficulty={difficulty}
					stage={stage}
					initialState={initialGameState}
					onWin={handleWin}
					onBack={handleBack}
					onStateChange={handleStateChange}
				/>
			)}
		</div>
	);
}

if (typeof window !== "undefined") {
	const appElement = document.getElementById("app");
	if (appElement) {
		hydrate(<App />, appElement);
	}
}

export async function prerender(data: Record<string, unknown>) {
	return await ssr(<App {...data} />);
}
