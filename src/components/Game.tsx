import type { FunctionalComponent } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { BoardGrid } from "@/components/game/BoardGrid";
import { CompletionDialog, ResetDialog } from "@/components/game/GameDialogs";
import { GameLoadingShell } from "@/components/game/GameShells";
import { getBoardLayout, groupBankTiles, sortTiles } from "@/components/game/gameUtils";
import { InventoryBank } from "@/components/game/InventoryBank";
import { StageHeader } from "@/components/game/StageHeader";
import { useBoardPan } from "@/components/game/useBoardPan";
import { useDialogFocus } from "@/components/game/useDialogFocus";
import { useGameValidation } from "@/components/game/useGameValidation";
import { useInventoryScroll } from "@/components/game/useInventoryScroll";
import { createGameState, useStandardGameState } from "@/components/game/useStandardGameState";
import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import type { TileData } from "@/services/math";
import type { GameMode, GameState } from "@/services/storage";

export { GameLoadingShell, UnavailableLevelShell } from "@/components/game/GameShells";

export interface GameStateChangeContext {
  clearedResetTilePlaced?: boolean;
}

interface GameProps {
  difficulty: GameMode;
  stage: number;
  maxStage: number;
  initialState?: GameState | null;
  createNewGame?: () => GameState;
  showNextLevelButton?: boolean;
  persistInitialState?: boolean;
  onWin: (newStage: number) => void;
  onBack: () => void;
  onStageChange: (newStage: number) => void;
  onStateChange: (state: GameState, context?: GameStateChangeContext) => void;
}

export const Game: FunctionalComponent<GameProps> = ({
  difficulty,
  stage,
  maxStage,
  initialState,
  createNewGame,
  showNextLevelButton = true,
  persistInitialState = initialState !== null && initialState !== undefined,
  onWin,
  onBack,
  onStageChange,
  onStateChange,
}) => {
  const { copy, t } = useAppSettings();
  const resetGridMetricsRef = useRef<() => void>(() => {});
  const hasHandledFirstStateRef = useRef(false);
  const saveFirstStateRef = useRef(persistInitialState);
  const preserveClearedSaveUntilTilePlacementRef = useRef(false);
  const clearClearedSaveOnNextStateChangeRef = useRef(false);
  const handleGenerated = useCallback(() => resetGridMetricsRef.current(), []);
  const { gameState, setGameState, showLoadingShell, isLoadingVisible } = useStandardGameState({
    difficulty,
    stage,
    initialState,
    onGenerated: handleGenerated,
  });
  const boardPan = useBoardPan(gameState);
  resetGridMetricsRef.current = boardPan.resetGridMetrics;

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);

  const gameContentRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const completionDialogRef = useRef<HTMLDialogElement>(null);
  const completionDismissRef = useRef<HTMLButtonElement>(null);
  const supportsModalDialog =
    typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal === "function";

  const isDialogOpen = isResetDialogOpen || isCompletionDialogOpen;
  const { canScrollLeft, canScrollRight, checkScroll } = useInventoryScroll(
    inventoryRef,
    gameState?.bank,
  );

  const dismissCompletionDialog = useCallback(() => {
    setIsCompletionDialogOpen(false);
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            status: "playing",
            solvedAcknowledged: true,
          }
        : prev,
    );
  }, [setGameState]);

  useAppReadinessSignal(gameState !== null, "game");

  useEffect(() => {
    const mainContent = gameContentRef.current;
    if (!mainContent) return;

    if (isDialogOpen) {
      mainContent.setAttribute("inert", "");
      mainContent.setAttribute("aria-hidden", "true");
    } else {
      mainContent.removeAttribute("inert");
      mainContent.removeAttribute("aria-hidden");
    }

    return () => {
      mainContent.removeAttribute("inert");
      mainContent.removeAttribute("aria-hidden");
    };
  }, [isDialogOpen]);

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog || !supportsModalDialog) return;
    if (isResetDialogOpen && !dialog.hasAttribute("open")) {
      dialog.showModal();
    }
  }, [isResetDialogOpen, supportsModalDialog]);

  useEffect(() => {
    const dialog = completionDialogRef.current;
    if (!dialog || !supportsModalDialog) return;
    if (isCompletionDialogOpen && !dialog.hasAttribute("open")) {
      dialog.showModal();
    }
  }, [isCompletionDialogOpen, supportsModalDialog]);

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog || !isResetDialogOpen) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      setIsResetDialogOpen(false);
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [isResetDialogOpen]);

  useEffect(() => {
    const dialog = completionDialogRef.current;
    if (!dialog || !isCompletionDialogOpen) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      dismissCompletionDialog();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [dismissCompletionDialog, isCompletionDialogOpen]);

  useDialogFocus({
    isDialogOpen,
    isResetDialogOpen,
    resetCancelRef,
    completionDismissRef,
  });

  useEffect(() => {
    if (gameState) {
      if (!hasHandledFirstStateRef.current) {
        hasHandledFirstStateRef.current = true;
        // Generated baselines are deterministic; saving them would overwrite another in-progress stage.
        if (!saveFirstStateRef.current) return;
      }
      if (preserveClearedSaveUntilTilePlacementRef.current) {
        return;
      }

      const context = clearClearedSaveOnNextStateChangeRef.current
        ? { clearedResetTilePlaced: true }
        : undefined;
      clearClearedSaveOnNextStateChangeRef.current = false;
      onStateChange({ ...gameState, difficulty, stage }, context);
    }
  }, [gameState, difficulty, stage, onStateChange]);

  useGameValidation({
    gameState,
    difficulty,
    copy,
    t,
    setGameState,
    setSelectedTileId,
    setToast,
    setIsCompletionDialogOpen,
  });

  const groupedBank = useMemo(() => (gameState ? groupBankTiles(gameState.bank) : []), [gameState]);

  const selectedTileType = useMemo<TileData["type"] | null>(() => {
    if (!gameState || !selectedTileId) return null;
    return gameState.bank.find((tile) => tile.id === selectedTileId)?.type ?? null;
  }, [gameState, selectedTileId]);

  const handleBoardClick = (key: string) => {
    if (gameState?.status !== "playing") return;

    const cell = gameState.board[key];
    if (cell?.isGiven) return;

    setGameState((prev) => {
      if (!prev) return null;
      const next: GameState = {
        ...prev,
        board: { ...prev.board },
        bank: [...prev.bank],
        solvedAcknowledged: false,
      };

      if (selectedTileId) {
        const bankIdx = next.bank.findIndex((tile) => tile.id === selectedTileId);
        if (bankIdx === -1) return prev;
        const tile = next.bank[bankIdx] as TileData;
        if (preserveClearedSaveUntilTilePlacementRef.current) {
          preserveClearedSaveUntilTilePlacementRef.current = false;
          clearClearedSaveOnNextStateChangeRef.current = true;
        }

        if (cell) {
          next.bank[bankIdx] = { id: cell.id, val: cell.val, type: cell.type };
        } else {
          next.bank.splice(bankIdx, 1);
        }

        next.board[key] = { id: tile.id, val: tile.val, type: tile.type, isGiven: false };
        setSelectedTileId(null);
      } else if (cell) {
        next.bank.push({ id: cell.id, val: cell.val, type: cell.type });
        delete next.board[key];
        sortTiles(next.bank);
      }

      return next;
    });
  };

  const confirmResetLevel = () => {
    const newGame = createNewGame ? createNewGame() : createGameState(stage, difficulty);
    preserveClearedSaveUntilTilePlacementRef.current =
      gameState?.status === "won" || gameState?.solvedAcknowledged === true;
    setGameState(newGame);
    setSelectedTileId(null);
    setIsCompletionDialogOpen(false);
    setIsResetDialogOpen(false);
    boardPan.resetGridMetrics();
  };

  if (!gameState) {
    return (
      <GameLoadingShell
        difficulty={difficulty}
        stage={stage}
        maxStage={maxStage}
        onBack={onBack}
        onStageChange={onStageChange}
      />
    );
  }

  const { board, status } = gameState;
  const boardLayout = getBoardLayout(board);

  return (
    <div className="theme-page-bg relative h-dvh w-full overflow-hidden">
      {showLoadingShell && (
        <div
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-200",
            isLoadingVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <GameLoadingShell
            difficulty={difficulty}
            stage={stage}
            maxStage={maxStage}
            onBack={onBack}
            onStageChange={onStageChange}
          />
        </div>
      )}

      <div
        className={cn("absolute inset-0 flex flex-col", isLoadingVisible && "pointer-events-none")}
      >
        <div ref={gameContentRef} className="flex h-full min-h-0 flex-1 flex-col">
          <StageHeader
            difficulty={difficulty}
            stage={stage}
            maxStage={maxStage}
            status={status}
            onBack={onBack}
            onStageChange={onStageChange}
            onReset={() => setIsResetDialogOpen(true)}
          />

          <div className="flex min-h-0 flex-1 flex-col animate-fade-in-soft">
            <BoardGrid
              board={board}
              boardContainerRef={boardPan.boardContainerRef}
              panContainerRef={boardPan.panContainerRef}
              panOffset={boardPan.panOffset}
              rows={boardLayout.rows}
              cols={boardLayout.cols}
              minR={boardLayout.minR}
              minC={boardLayout.minC}
              fringe={boardLayout.fringe}
              toast={toast}
              selectedTileId={selectedTileId}
              selectedTileType={selectedTileType}
              onBoardClick={handleBoardClick}
              onPointerDown={boardPan.handlePointerDown}
              onPointerMove={boardPan.handlePointerMove}
              onPointerUp={boardPan.handlePointerUp}
              onClickCapture={boardPan.handleCaptureClick}
            />

            <InventoryBank
              groups={groupedBank}
              selectedTileId={selectedTileId}
              status={status}
              inventoryRef={inventoryRef}
              canScrollLeft={canScrollLeft}
              canScrollRight={canScrollRight}
              onScroll={checkScroll}
              onSelectTile={setSelectedTileId}
            />
          </div>
        </div>
      </div>

      <ResetDialog
        dialogRef={resetDialogRef}
        cancelRef={resetCancelRef}
        supportsModalDialog={supportsModalDialog}
        isOpen={isResetDialogOpen}
        onCancel={() => setIsResetDialogOpen(false)}
        onConfirm={confirmResetLevel}
      />

      <CompletionDialog
        dialogRef={completionDialogRef}
        dismissRef={completionDismissRef}
        supportsModalDialog={supportsModalDialog}
        isOpen={isCompletionDialogOpen}
        showNextLevelButton={showNextLevelButton}
        onDismiss={dismissCompletionDialog}
        onNextLevel={() => onWin(stage + 1)}
      />
    </div>
  );
};
