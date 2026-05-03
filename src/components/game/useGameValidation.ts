import { useEffect } from "preact/hooks";
import type { Messages, TFunction } from "@/lib/i18n";
import { getGridBounds, validateBoard } from "@/services/board";
import type { GameMode, GameState } from "@/services/storage";

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export const useGameValidation = ({
  gameState,
  difficulty,
  copy,
  t,
  setGameState,
  setSelectedTileId,
  setToast,
  setIsCompletionDialogOpen,
}: {
  gameState: GameState | null;
  difficulty: GameMode;
  copy: Messages;
  t: TFunction;
  setGameState: Setter<GameState | null>;
  setSelectedTileId: Setter<string | null>;
  setToast: Setter<string | null>;
  setIsCompletionDialogOpen: Setter<boolean>;
}) => {
  useEffect(() => {
    if (gameState?.status !== "playing") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (gameState.bank.length === 0 && !gameState.solvedAcknowledged) {
      const validation = validateBoard(gameState.board);
      if (validation.valid) {
        const customConfig = gameState.customConfig;
        if (difficulty === "Custom" && customConfig?.limitSolutionSize) {
          const bounds = getGridBounds(Object.keys(gameState.board));
          const width = bounds.maxC - bounds.minC + 1;
          const height = bounds.maxR - bounds.minR + 1;
          if (width > customConfig.sizeLimit || height > customConfig.sizeLimit) {
            setToast(copy.game.solutionTooLarge);
            timer = setTimeout(() => setToast(null), 3500);
            return () => {
              if (timer) clearTimeout(timer);
            };
          }
        }

        setGameState((prev) => (prev ? { ...prev, status: "won" } : null));
        setSelectedTileId(null);
        setToast(null);
        setIsCompletionDialogOpen(true);
      } else {
        const validationKey = `game.validation.${validation.reason.code}`;
        if (validation.reason.code === "invalidFormula") {
          setToast(t(validationKey, { formula: validation.reason.formula }));
        } else {
          setToast(t(validationKey));
        }
        timer = setTimeout(() => setToast(null), 3500);
      }
    } else {
      setToast(null);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    copy,
    difficulty,
    gameState,
    setGameState,
    setIsCompletionDialogOpen,
    setSelectedTileId,
    setToast,
    t,
  ]);
};
