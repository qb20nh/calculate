import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-preact";
import type { FunctionalComponent } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { cn } from "@/lib/utils";
import { generateGame, getGridBounds, validateBoard } from "@/services/board";
import type { TileData } from "@/services/math";
import type { Difficulty, GameState } from "@/services/storage";

interface GameProps {
  difficulty: Difficulty;
  stage: number;
  maxStage: number;
  initialState?: GameState | null;
  onWin: (newStage: number) => void;
  onBack: () => void;
  onStageChange: (newStage: number) => void;
  onStateChange: (state: GameState) => void;
}

const BoardCell: FunctionalComponent<{
  cellKey: string;
  cell: (TileData & { isGiven?: boolean }) | undefined;
  isFringe: boolean;
  selectedTileId: string | null;
  onClick: (key: string) => void;
}> = ({ cellKey, cell, isFringe, selectedTileId, onClick }) => {
  if (!cell && !isFringe) {
    return <div className="w-full h-full pointer-events-none" />;
  }

  const handleAction = () => onClick(cellKey);
  const handleKeyDown = (e: KeyboardEvent) => e.key === "Enter" && handleAction();

  if (!cell && isFringe) {
    return (
      <button
        type="button"
        onClick={handleAction}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={cn("fringe-slot m-[1px]", selectedTileId && "highlight")}
        aria-label="Place tile here"
      />
    );
  }

  if (!cell) return null;

  const content = cell.val;
  const typeClass = cell.isGiven ? "tile-given" : `tile-${cell.type}`;

  return (
    <button
      type="button"
      onClick={handleAction}
      onKeyDown={handleKeyDown}
      tabIndex={cell.isGiven ? -1 : 0}
      className={cn(
        "tile m-[1px] text-lg md:text-xl animate-fade-in select-none",
        typeClass,
        selectedTileId === cell.id && "ring-4 ring-indigo-400 ring-offset-2",
      )}
    >
      {content}
    </button>
  );
};

const GameHeader: FunctionalComponent<{
  difficulty: Difficulty;
  stage: number;
  maxStage: number;
  status?: GameState["status"];
  onBack: () => void;
  onStageChange: (newStage: number) => void;
  onReset?: () => void;
}> = ({ difficulty, stage, maxStage, status, onBack, onStageChange, onReset }) => (
  <div className="flex justify-between items-center p-3 sm:p-4 bg-white shadow-sm z-20 shrink-0 border-b border-slate-100">
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-full"
      >
        <ChevronLeft width={20} height={20} strokeWidth={2.5} />
      </button>

      <div className="h-8 w-[1px] bg-slate-100 mx-1" />

      <div className="flex items-center bg-indigo-50 rounded-full shadow-inner border border-indigo-100 overflow-hidden">
        <button
          type="button"
          onClick={() => onStageChange(stage - 1)}
          disabled={stage <= 1}
          className="px-2 py-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Previous Stage"
        >
          <ChevronLeft width={16} height={16} strokeWidth={3} />
        </button>
        <span className="px-2 py-1 text-indigo-800 text-sm font-bold whitespace-nowrap text-center min-w-[120px]">
          {difficulty} — Stage {stage}
        </span>
        <button
          type="button"
          onClick={() => onStageChange(stage + 1)}
          disabled={stage >= maxStage && status !== "won"}
          className="px-2 py-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Next Stage"
        >
          <ChevronRight width={16} height={16} strokeWidth={3} />
        </button>
      </div>
    </div>

    <button
      type="button"
      onClick={onReset}
      disabled={!onReset}
      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-full disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
      aria-label="Reset Stage"
    >
      <RotateCcw width={20} height={20} strokeWidth={2.5} />
    </button>
  </div>
);

export const GameLoadingShell: FunctionalComponent<{
  difficulty: Difficulty;
  stage: number;
  maxStage: number;
  notice?: string | undefined;
  onBack: () => void;
  onStageChange: (newStage: number) => void;
}> = ({ difficulty, stage, maxStage, notice, onBack, onStageChange }) => (
  <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
    <GameHeader
      difficulty={difficulty}
      stage={stage}
      maxStage={maxStage}
      onBack={onBack}
      onStageChange={onStageChange}
    />
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center font-bold text-slate-500">
      {notice && (
        <p className="max-w-xs rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-700 border border-amber-100">
          {notice}
        </p>
      )}
      <p>Generating Puzzle...</p>
    </div>
  </div>
);

export const Game: FunctionalComponent<GameProps> = ({
  difficulty,
  stage,
  maxStage,
  initialState,
  onWin,
  onBack,
  onStageChange,
  onStateChange,
}) => {
  const [gameState, setGameState] = useState<GameState | null>(initialState || null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Initialize game
  useEffect(() => {
    if (!initialState) {
      const newGame = generateGame(stage, difficulty);
      setGameState({ ...newGame, difficulty, stage, solvedAcknowledged: false });
    }
  }, [stage, difficulty, initialState]);

  // Auto-scroll to center
  useEffect(() => {
    if (
      gameState?.status === "playing" &&
      gameState.bank.length === gameState.initialBankSize &&
      boardContainerRef.current
    ) {
      const el = boardContainerRef.current;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [gameState]);

  // Persist state
  useEffect(() => {
    if (gameState) {
      onStateChange({ ...gameState, difficulty, stage });
    }
  }, [gameState, difficulty, stage, onStateChange]);

  // Validation logic
  useEffect(() => {
    if (gameState?.status !== "playing") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (gameState.bank.length === 0 && !gameState.solvedAcknowledged) {
      const validation = validateBoard(gameState.board);
      if (validation.valid) {
        setGameState((prev) => (prev ? { ...prev, status: "won" } : null));
        setSelectedTileId(null);
        setToast(null);
        onWin(stage + 1);
      } else {
        setToast(validation.reason);
        timer = setTimeout(() => setToast(null), 3500);
      }
    } else {
      setToast(null);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [gameState, stage, onWin]);

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
        const bankIdx = next.bank.findIndex((t) => t.id === selectedTileId);
        if (bankIdx === -1) return prev;
        const tile = next.bank[bankIdx] as TileData;

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

        next.bank.sort((a, b) => {
          const w = (t: TileData) => (t.type === "val" ? 1 : t.type === "op" ? 2 : 3);
          if (w(a) !== w(b)) return w(a) - w(b);
          return String(a.val).localeCompare(String(b.val));
        });
      }

      return next;
    });
  };

  const resetLevel = () => {
    const newGame = generateGame(stage, difficulty);
    setGameState({ ...newGame, difficulty, stage, solvedAcknowledged: false });
    setSelectedTileId(null);
  };

  const groupedBank = useMemo(() => {
    if (!gameState) return [];
    const groups: { val: string; type: string; tiles: TileData[] }[] = [];
    const groupMap: Record<string, { val: string; type: string; tiles: TileData[] }> = {};
    for (const tile of gameState.bank) {
      const group = groupMap[tile.val];
      if (group) {
        group.tiles.push(tile);
      } else {
        const nextGroup = { val: tile.val, type: tile.type, tiles: [tile] };
        groupMap[tile.val] = nextGroup;
        groups.push(nextGroup);
      }
    }
    return groups;
  }, [gameState]);

  if (!gameState)
    return (
      <GameLoadingShell
        difficulty={difficulty}
        stage={stage}
        maxStage={maxStage}
        onBack={onBack}
        onStageChange={onStageChange}
      />
    );

  const { board, status } = gameState;

  // Calculate bounds
  const fringe = new Set<string>();
  for (const k of Object.keys(board)) {
    const [rStr, cStr] = k.split(",");
    const r = Number(rStr);
    const c = Number(cStr);
    const neighbors = [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ];
    for (const [nr, nc] of neighbors) {
      const nk = `${nr},${nc}`;
      if (!board[nk]) fringe.add(nk);
    }
  }

  const allRelevantKeys = [...Object.keys(board), ...Array.from(fringe)];
  const bounds = getGridBounds(allRelevantKeys);

  const minR = bounds.minR - 1;
  const maxR = bounds.maxR + 1;
  const minC = bounds.minC - 1;
  const maxC = bounds.maxC + 1;

  const cols = maxC - minC + 1;
  const rows = maxR - minR + 1;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
      <GameHeader
        difficulty={difficulty}
        stage={stage}
        maxStage={maxStage}
        status={status}
        onBack={onBack}
        onStageChange={onStageChange}
        onReset={resetLevel}
      />

      <div className="flex-1 relative board-container" ref={boardContainerRef}>
        <div className="m-auto p-12 flex items-center justify-center animate-fade-in min-h-full min-w-full w-fit">
          <div
            className="grid gap-0 bg-slate-100/30 rounded-lg p-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, 2.75rem)`,
              gridTemplateRows: `repeat(${rows}, 2.75rem)`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => {
              const r = Math.floor(i / cols) + minR;
              const c = (i % cols) + minC;
              const key = `${r},${c}`;
              return (
                <BoardCell
                  key={key}
                  cellKey={key}
                  cell={board[key]}
                  isFringe={fringe.has(key)}
                  selectedTileId={selectedTileId}
                  onClick={handleBoardClick}
                />
              );
            })}
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[60] animate-fade-in font-medium text-sm md:text-base whitespace-nowrap">
            {toast}
          </div>
        )}

        {status === "won" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-10 border border-slate-100 flex flex-col items-center text-center max-w-xs w-full">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check
                  width={40}
                  height={40}
                  strokeWidth={3}
                  className="text-green-600"
                  aria-label="Success"
                />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Perfect!</h2>
              <p className="text-slate-500 mb-8 font-medium">You cleared the board.</p>
              <button
                type="button"
                onClick={() =>
                  setGameState((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: "playing",
                          solvedAcknowledged: true,
                        }
                      : null,
                  )
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-xl transform transition active:scale-95 text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] shrink-0 z-20 pb-safe">
        <div className="max-w-4xl mx-auto p-4 md:p-6 overflow-x-auto board-container">
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 min-w-min pb-2">
            {groupedBank.map((group) => {
              const content = group.val;
              const isSelected =
                selectedTileId !== null &&
                group.tiles.some((t: TileData) => t.id === selectedTileId);
              const count = group.tiles.length;
              const firstTile = group.tiles[0];
              if (!firstTile) return null;

              return (
                <div key={group.val} className="relative m-1 inline-block">
                  {count > 1 && (
                    <div
                      className={cn(
                        "absolute top-1 left-1 w-full h-full rounded-[2px] pointer-events-none opacity-50",
                        `tile-${group.type}`,
                      )}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (gameState?.status !== "playing") return;
                      if (isSelected) {
                        setSelectedTileId(null);
                      } else {
                        setSelectedTileId(firstTile.id);
                      }
                    }}
                    className={cn(
                      "tile w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl flex-shrink-0 relative z-10",
                      `tile-${group.type}`,
                      isSelected && "selected scale-110 ring-4 ring-indigo-400",
                    )}
                  >
                    {content}
                  </button>

                  {count > 1 && (
                    <div className="absolute -top-2.5 -right-2.5 bg-indigo-600 text-white text-[10px] sm:text-xs font-bold h-5 sm:h-6 min-w-[20px] sm:min-w-[24px] px-1.5 flex items-center justify-center rounded-full z-20 shadow-md border-2 border-white pointer-events-none">
                      {count}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedBank.length === 0 && (
              <div className="text-slate-400 font-medium italic py-3 px-4">Bank is empty.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
