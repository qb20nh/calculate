import { useEffect, useState } from "preact/hooks";
import { generateCrossingGame, generateGame } from "@/services/board";
import type { Difficulty, GameMode, GameState } from "@/services/storage";

const createStandardGameState = (
  stage: number,
  difficulty: Difficulty,
  maxAttempts = 3000,
): GameState => {
  let generatedGame: ReturnType<typeof generateGame> | null = null;
  let attempt = 0;
  while (!generatedGame && attempt < maxAttempts) {
    const candidate = generateGame(stage, difficulty, attempt);
    if (Object.keys(candidate.board).length > 0) generatedGame = candidate;
    attempt++;
  }

  return {
    ...(generatedGame || { board: {}, bank: [], initialBankSize: 0, status: "playing" as const }),
    difficulty,
    stage,
    solvedAcknowledged: false,
  };
};

export const createGameState = (stage: number, difficulty: GameMode): GameState => {
  if (difficulty === "Crossing") {
    const game = generateCrossingGame(stage);
    return {
      ...(game || { board: {}, bank: [], initialBankSize: 0, status: "playing" as const }),
      difficulty,
      stage,
      solvedAcknowledged: false,
    };
  }

  if (difficulty === "Custom") {
    return {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty,
      stage,
      solvedAcknowledged: false,
    };
  }

  return createStandardGameState(stage, difficulty);
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

    setGameState(createGameState(stage, difficulty));
    onGenerated();
  }, [stage, difficulty, initialState, onGenerated]);

  return { gameState, setGameState, showLoadingShell, isLoadingVisible };
};
