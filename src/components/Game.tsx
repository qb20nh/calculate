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
  selectedTileType: TileData["type"] | null;
  onClick: (key: string) => void;
}> = ({ cellKey, cell, isFringe, selectedTileId, selectedTileType, onClick }) => {
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
        className={cn(
          "fringe-slot m-[1px]",
          selectedTileId && selectedTileType && "highlight",
          selectedTileType && `highlight-${selectedTileType}`,
        )}
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
        "tile m-[1px] text-xl md:text-2xl animate-fade-in select-none",
        typeClass,
        selectedTileId === cell.id && `selected selected-${cell.type}`,
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
}> = ({ difficulty, stage, maxStage, status, onBack, onStageChange, onReset }) => {
  const levelBar = (
    <div className="flex items-center theme-primary-bg-soft rounded-full shadow-inner theme-primary-border overflow-hidden">
      <button
        type="button"
        onClick={() => onStageChange(stage - 1)}
        disabled={stage <= 1}
        className="px-2 py-1 text-slate-400 theme-primary-hover-text theme-primary-hover-bg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Previous Stage"
      >
        <ChevronLeft width={16} height={16} strokeWidth={3} />
      </button>
      <span
        id="skeleton-title"
        className="px-2 py-1 theme-primary-text text-sm font-bold whitespace-nowrap text-center min-w-[120px]"
      >
        {difficulty} — Stage {stage}
      </span>
      <button
        type="button"
        onClick={() => onStageChange(stage + 1)}
        disabled={stage >= maxStage && status !== "won"}
        className="px-2 py-1 text-slate-400 theme-primary-hover-text theme-primary-hover-bg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Next Stage"
      >
        <ChevronRight width={16} height={16} strokeWidth={3} />
      </button>
    </div>
  );

  return (
    <div className="flex justify-between items-center p-3 sm:p-4 bg-white shadow-sm z-20 shrink-0 border-b border-slate-100 relative">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="p-2 text-slate-400 theme-primary-hover-text theme-primary-hover-bg transition-colors rounded-full"
        >
          <ChevronLeft width={20} height={20} strokeWidth={2.5} />
        </button>

        <div className="hidden sm:block h-8 w-[1px] bg-slate-100 mx-1" />

        <div className="hidden sm:block">{levelBar}</div>
      </div>

      <div className="sm:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {levelBar}
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={!onReset}
        className="p-2 text-slate-400 theme-danger-text theme-danger-hover-bg transition-colors rounded-full disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Reset Stage"
      >
        <RotateCcw width={20} height={20} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export const UnavailableLevelShell: FunctionalComponent<{
  difficulty: Difficulty;
  requestedStage: number;
  availableStage: number;
  notice: string;
  onBack: () => void;
  onLatestAvailable: () => void;
}> = ({ difficulty, requestedStage, availableStage, notice, onBack, onLatestAvailable }) => (
  <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
    <div className="flex justify-between items-center p-3 sm:p-4 bg-white shadow-sm z-20 shrink-0 border-b border-slate-100">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="p-2 text-slate-400 theme-primary-hover-text theme-primary-hover-bg transition-colors rounded-full"
      >
        <ChevronLeft width={20} height={20} strokeWidth={2.5} />
      </button>
      <div className="text-slate-400 text-sm font-semibold uppercase tracking-[0.2em]">
        {difficulty}
      </div>
      <div className="w-10" />
    </div>

    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">
          Stage {requestedStage} locked
        </h1>
        <p className="mt-3 text-slate-500 font-medium">{notice}</p>
        <p className="mt-2 text-sm text-slate-400">Latest available: Stage {availableStage}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
          >
            Main menu
          </button>
          <button
            type="button"
            onClick={onLatestAvailable}
            className="flex-1 rounded-2xl theme-primary-bg px-5 py-3 font-bold text-white shadow-xl transition active:scale-95"
          >
            Latest available
          </button>
        </div>
      </div>
    </div>
  </div>
);

const GameLoadingShell: FunctionalComponent<{
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
        <p className="max-w-xs rounded-2xl theme-operator-bg-soft theme-operator-text px-5 py-3 text-sm border theme-operator-border">
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
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const gameContentRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const completionDialogRef = useRef<HTMLDialogElement>(null);
  const completionDismissRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const supportsModalDialog =
    typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal === "function";

  const isDialogOpen = isResetDialogOpen || isCompletionDialogOpen;

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
    if (!dialog) return;
    if (!supportsModalDialog) return;
    if (isResetDialogOpen && !dialog.hasAttribute("open")) {
      dialog.showModal();
    }
  }, [isResetDialogOpen, supportsModalDialog]);

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
    if (!dialog) return;
    if (!supportsModalDialog) return;
    if (isCompletionDialogOpen && !dialog.hasAttribute("open")) {
      dialog.showModal();
    }
  }, [isCompletionDialogOpen, supportsModalDialog]);

  useEffect(() => {
    const dialog = completionDialogRef.current;
    if (!dialog || !isCompletionDialogOpen) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      dismissCompletionDialog();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [isCompletionDialogOpen]);

  useEffect(() => {
    if (!isDialogOpen) {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialFocus = isResetDialogOpen ? resetCancelRef.current : completionDismissRef.current;
    initialFocus?.focus();
  }, [isDialogOpen, isResetDialogOpen, isCompletionDialogOpen]);

  const checkScroll = () => {
    if (inventoryRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = inventoryRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [gameState?.bank]);

  // Initialize game
  useEffect(() => {
    if (!initialState) {
      const newGame = generateGame(stage, difficulty);
      setGameState({ ...newGame, difficulty, stage, solvedAcknowledged: false });
      prevGridMetrics.current.initialized = false;
    }
  }, [stage, difficulty, initialState]);

  const panOffset = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const initialPointer = useRef({ x: 0, y: 0 });
  const panContainerRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef({ minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 });
  const hasDragged = useRef(false);
  const prevGridMetrics = useRef({
    minC: 0,
    minR: 0,
    cols: 0,
    rows: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    initialized: false,
  });

  const clampPan = (x: number, y: number) => {
    const { minX, maxX, minY, maxY } = boundsRef.current;
    const cx = minX <= maxX ? Math.max(minX, Math.min(maxX, x)) : 0;
    const cy = minY <= maxY ? Math.max(minY, Math.min(maxY, y)) : 0;
    return { x: cx, y: cy };
  };

  const updatePan = (x: number, y: number) => {
    const clamped = clampPan(x, y);
    panOffset.current = clamped;
    if (panContainerRef.current) {
      panContainerRef.current.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`;
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    isPanning.current = true;
    hasDragged.current = false;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    initialPointer.current = { x: e.clientX, y: e.clientY };
    if (boardContainerRef.current?.setPointerCapture) {
      boardContainerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isPanning.current) return;

    if (!hasDragged.current) {
      const totalDx = e.clientX - initialPointer.current.x;
      const totalDy = e.clientY - initialPointer.current.y;
      // 4px touch slop
      if (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4) {
        hasDragged.current = true;
      }
    }

    if (hasDragged.current) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      updatePan(panOffset.current.x + dx, panOffset.current.y + dy);
    }

    lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: PointerEvent) => {
    isPanning.current = false;
    if (boardContainerRef.current?.hasPointerCapture?.(e.pointerId)) {
      boardContainerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleCaptureClick = (e: MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged.current = false;
    }
  };

  // Update pan bounds when board changes or window resizes
  useEffect(() => {
    const calc = () => {
      if (!boardContainerRef.current || gameState?.status !== "playing") return;

      const placedAndGivenKeys = Object.keys(gameState.board);
      if (placedAndGivenKeys.length === 0) return;

      const fringe = new Set<string>();
      for (const k of placedAndGivenKeys) {
        const [rStr, cStr] = k.split(",");
        const r = Number(rStr);
        const c = Number(cStr);
        const neighbors = [`${r + 1},${c}`, `${r - 1},${c}`, `${r},${c + 1}`, `${r},${c - 1}`];
        for (const nk of neighbors) {
          if (!gameState.board[nk]) fringe.add(nk);
        }
      }

      const allRelevantKeys = [...placedAndGivenKeys, ...Array.from(fringe)];
      let minR = Infinity,
        maxR = -Infinity,
        minC = Infinity,
        maxC = -Infinity;
      for (const k of allRelevantKeys) {
        const [rStr, cStr] = k.split(",");
        const r = Number(rStr),
          c = Number(cStr);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }

      minR -= 1;
      maxR += 1;
      minC -= 1;
      maxC += 1;

      const cols = maxC - minC + 1;
      const rows = maxR - minR + 1;

      let pMinR = Infinity,
        pMaxR = -Infinity,
        pMinC = Infinity,
        pMaxC = -Infinity;
      for (const k of placedAndGivenKeys) {
        const [rStr, cStr] = k.split(",");
        const r = Number(rStr),
          c = Number(cStr);
        pMinR = Math.min(pMinR, r);
        pMaxR = Math.max(pMaxR, r);
        pMinC = Math.min(pMinC, c);
        pMaxC = Math.max(pMaxC, c);
      }

      const TILE_SIZE = 44;
      const viewportWidth = boardContainerRef.current.clientWidth || 300;
      const viewportHeight = boardContainerRef.current.clientHeight || 300;

      let curPanX = panOffset.current.x;
      let curPanY = panOffset.current.y;

      if (prevGridMetrics.current.initialized) {
        curPanX += (minC - prevGridMetrics.current.minC) * TILE_SIZE;
        curPanY += (minR - prevGridMetrics.current.minR) * TILE_SIZE;

        const dw = viewportWidth - prevGridMetrics.current.viewportWidth;
        const dh = viewportHeight - prevGridMetrics.current.viewportHeight;
        curPanX += dw / 2;
        curPanY += dh / 2;
      } else {
        curPanX = viewportWidth / 2 - (cols * TILE_SIZE) / 2;
        curPanY = viewportHeight / 2 - (rows * TILE_SIZE) / 2;
      }

      prevGridMetrics.current = {
        minC,
        minR,
        cols,
        rows,
        viewportWidth,
        viewportHeight,
        initialized: true,
      };

      const pMinX = (pMinC - minC) * TILE_SIZE;
      const pMaxX = (pMaxC - minC + 1) * TILE_SIZE;
      const pMinY = (pMinR - minR) * TILE_SIZE;
      const pMaxY = (pMaxR - minR + 1) * TILE_SIZE;

      const minX = TILE_SIZE - pMaxX;
      const maxX = viewportWidth - TILE_SIZE - pMinX;
      const minY = TILE_SIZE - pMaxY;
      const maxY = viewportHeight - TILE_SIZE - pMinY;

      boundsRef.current = { minX, maxX, minY, maxY };
      updatePan(curPanX, curPanY);
    };

    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [gameState?.board]);

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
        setIsCompletionDialogOpen(true);
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
    setIsResetDialogOpen(true);
  };

  const confirmResetLevel = () => {
    const newGame = generateGame(stage, difficulty);
    setGameState({ ...newGame, difficulty, stage, solvedAcknowledged: false });
    setSelectedTileId(null);
    setIsCompletionDialogOpen(false);
    setIsResetDialogOpen(false);
    prevGridMetrics.current.initialized = false;
  };

  const dismissCompletionDialog = () => {
    setIsCompletionDialogOpen(false);
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            status: "playing",
            solvedAcknowledged: true,
          }
        : null,
    );
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

  const selectedTileType = useMemo<TileData["type"] | null>(() => {
    if (!gameState || !selectedTileId) return null;
    return gameState.bank.find((tile) => tile.id === selectedTileId)?.type ?? null;
  }, [gameState, selectedTileId]);

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
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-slate-50">
      <div ref={gameContentRef} className="flex min-h-0 flex-1 flex-col">
        <GameHeader
          difficulty={difficulty}
          stage={stage}
          maxStage={maxStage}
          status={status}
          onBack={onBack}
          onStageChange={onStageChange}
          onReset={resetLevel}
        />

        <div
          className="flex-1 relative overflow-hidden touch-none select-none"
          ref={boardContainerRef}
          data-testid="game-board-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClickCapture={handleCaptureClick}
        >
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none animate-fade-in">
            <div
              ref={panContainerRef}
              className="bg-slate-100/30 rounded-lg p-1 absolute top-0 left-0 pointer-events-auto transition-none"
              style={{
                display: "grid",
                gap: 0,
                gridTemplateColumns: `repeat(${cols}, 2.75rem)`,
                gridTemplateRows: `repeat(${rows}, 2.75rem)`,
                transform: `translate(${panOffset.current.x}px, ${panOffset.current.y}px)`,
                willChange: "transform",
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
                    selectedTileType={selectedTileType}
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
        </div>

        <div className="bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] shrink-0 z-20 pb-safe">
          <div className="max-w-4xl mx-auto relative">
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-30" />
            )}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-30" />
            )}
            <div
              ref={inventoryRef}
              onScroll={checkScroll}
              className="pt-4 px-8 pb-6 md:pt-6 md:pb-8 overflow-x-auto board-container flex flex-nowrap md:flex-wrap md:justify-center gap-3 md:gap-4"
              style={{ justifyContent: "safe center" }}
            >
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
                        "tile w-11 h-11 text-xl md:text-2xl flex-shrink-0 relative z-10",
                        `tile-${group.type}`,
                        isSelected && "selected",
                      )}
                    >
                      {content}
                    </button>

                    {count > 1 && (
                      <div
                        className={cn(
                          "absolute -top-2.5 -right-2.5 text-white text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full z-20 shadow-md border-2 border-white pointer-events-none",
                          group.type === "val"
                            ? "theme-number-bg"
                            : group.type === "op"
                              ? "theme-operator-bg"
                              : "theme-relation-bg",
                        )}
                      >
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

      {isResetDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <dialog
            ref={resetDialogRef}
            open={!supportsModalDialog && isResetDialogOpen}
            className="rounded-3xl border border-slate-100 bg-white p-0 shadow-2xl animate-fade-in"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-desc"
          >
            <div className="max-w-sm p-8 text-center">
              <h2
                id="reset-dialog-title"
                className="text-2xl font-black tracking-tight text-slate-800"
              >
                Reset this stage?
              </h2>
              <p id="reset-dialog-desc" className="mt-3 text-slate-500 font-medium">
                Current progress on this stage will be lost.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  ref={resetCancelRef}
                  type="button"
                  onClick={() => setIsResetDialogOpen(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmResetLevel}
                  className="flex-1 rounded-2xl theme-danger-bg px-5 py-3 font-bold text-white shadow-xl transition active:scale-95"
                >
                  Reset
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}

      {isCompletionDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <dialog
            ref={completionDialogRef}
            open={!supportsModalDialog && isCompletionDialogOpen}
            className="rounded-[2rem] border border-slate-100 bg-white p-0 shadow-2xl animate-fade-in"
            aria-labelledby="completion-dialog-title"
            aria-describedby="completion-dialog-desc"
          >
            <div className="max-w-xs w-full p-10 text-center">
              <div className="mx-auto w-20 h-20 theme-number-bg-soft rounded-full flex items-center justify-center mb-6">
                <Check
                  width={40}
                  height={40}
                  strokeWidth={3}
                  className="theme-number-text"
                  aria-label="Success"
                />
              </div>
              <h2
                id="completion-dialog-title"
                className="text-3xl font-black text-slate-800 mb-2 tracking-tight"
              >
                Perfect!
              </h2>
              <p id="completion-dialog-desc" className="text-slate-500 mb-8 font-medium">
                You cleared the board.
              </p>
              <div className="w-full flex flex-col gap-3">
                <button
                  ref={completionDismissRef}
                  type="button"
                  onClick={dismissCompletionDialog}
                  className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 px-8 rounded-2xl shadow-sm transform transition active:scale-95 text-lg"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => onWin(stage + 1)}
                  className="w-full theme-primary-bg text-white font-bold py-4 px-8 rounded-2xl shadow-xl transform transition active:scale-95 text-lg"
                >
                  Next level
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
};
