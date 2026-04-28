import { useEffect, useState } from "preact/hooks";
import { generateGame } from "@/services/board";
import type { Difficulty, GameMode, GameState } from "@/services/storage";

export const createStandardGameState = (
  stage: number,
  difficulty: Difficulty,
  maxAttempts = 3000,
): GameState => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const game = generateGame(stage, difficulty, attempt);
    if (Object.keys(game.board).length > 0) {
      return { ...game, difficulty, stage, solvedAcknowledged: false };
    }
  }

  return {
    board: {},
    bank: [],
    initialBankSize: 0,
    status: "playing",
    difficulty,
    stage,
    solvedAcknowledged: false,
  };
};

export const useStandardGameState = ({
  difficulty,
  stage,
  initialState,
  onGenerated,
}: {
  difficulty: GameMode;
  stage: number;
  initialState: GameState | null | undefined;
  onGenerated: () => void;
}) => {
  const [gameState, setGameState] = useState<GameState | null>(initialState || null);
  const [showLoadingShell, setShowLoadingShell] = useState(initialState === null);
  const [isLoadingVisible, setIsLoadingVisible] = useState(initialState === null);

  useEffect(() => {
    if (!gameState) {
      setShowLoadingShell(initialState === null);
      setIsLoadingVisible(initialState === null);
      return;
    }

    if (initialState !== null) {
      setShowLoadingShell(false);
      setIsLoadingVisible(false);
      return;
    }

    setShowLoadingShell(true);
    setIsLoadingVisible(false);
    const timeout = window.setTimeout(() => {
      setShowLoadingShell(false);
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [gameState, initialState]);

  useEffect(() => {
    if (initialState) return;
    if (difficulty === "Custom") return;

    setGameState(createStandardGameState(stage, difficulty as Difficulty));
    onGenerated();
  }, [stage, difficulty, initialState, onGenerated]);

  return { gameState, setGameState, showLoadingShell, isLoadingVisible };
};
