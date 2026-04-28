import type { FunctionalComponent, RefObject } from "preact";
import { TILE_SIZE } from "@/components/game/gameUtils";
import { useAppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import type { TileData } from "@/services/math";
import type { GameState } from "@/services/storage";

const BoardCell: FunctionalComponent<{
  cellKey: string;
  cell: (TileData & { isGiven?: boolean }) | undefined;
  isFringe: boolean;
  selectedTileId: string | null;
  selectedTileType: TileData["type"] | null;
  onClick: (key: string) => void;
}> = ({ cellKey, cell, isFringe, selectedTileId, selectedTileType, onClick }) => {
  const { copy } = useAppSettings();
  if (!cell && !isFringe) {
    return <div className="w-full h-full pointer-events-none" />;
  }

  const handleAction = () => onClick(cellKey);

  if (!cell && isFringe) {
    return (
      <button
        type="button"
        onClick={handleAction}
        tabIndex={0}
        className={cn(
          "fringe-slot m-[1px]",
          selectedTileId && selectedTileType && "highlight",
          selectedTileType && `highlight-${selectedTileType}`,
        )}
        aria-label={copy.game.placeTileHere}
      />
    );
  }

  if (!cell) return null;

  const typeClass = cell.isGiven ? "tile-given" : `tile-${cell.type}`;

  return (
    <button
      type="button"
      onClick={handleAction}
      tabIndex={cell.isGiven ? -1 : 0}
      className={cn(
        "tile m-[1px] text-xl md:text-2xl select-none",
        typeClass,
        selectedTileId === cell.id && `selected selected-${cell.type}`,
      )}
    >
      {cell.val}
    </button>
  );
};

export const BoardGrid: FunctionalComponent<{
  board: GameState["board"];
  boardContainerRef: RefObject<HTMLDivElement>;
  panContainerRef: RefObject<HTMLDivElement>;
  panOffset: RefObject<{ x: number; y: number }>;
  rows: number;
  cols: number;
  minR: number;
  minC: number;
  fringe: Set<string>;
  toast: string | null;
  selectedTileId: string | null;
  selectedTileType: TileData["type"] | null;
  onBoardClick: (key: string) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onClickCapture: (event: MouseEvent) => void;
}> = ({
  board,
  boardContainerRef,
  panContainerRef,
  panOffset,
  rows,
  cols,
  minR,
  minC,
  fringe,
  toast,
  selectedTileId,
  selectedTileType,
  onBoardClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClickCapture,
}) => (
  <div
    className="flex-1 relative overflow-hidden touch-none select-none"
    ref={boardContainerRef}
    data-testid="game-board-container"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerLeave={onPointerUp}
    onPointerCancel={onPointerUp}
    onClickCapture={onClickCapture}
  >
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <div
        ref={panContainerRef}
        className="absolute top-0 left-0 pointer-events-auto transition-none"
        style={{
          display: "grid",
          gap: 0,
          gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
          transform: `translate(${Math.round(panOffset.current?.x ?? 0)}px, ${Math.round(
            panOffset.current?.y ?? 0,
          )}px)`,
          willChange: "transform",
        }}
      >
        {Array.from({ length: rows * cols }).map((_, index) => {
          const r = Math.floor(index / cols) + minR;
          const c = (index % cols) + minC;
          const key = `${r},${c}`;
          return (
            <BoardCell
              key={key}
              cellKey={key}
              cell={board[key]}
              isFringe={fringe.has(key)}
              selectedTileId={selectedTileId}
              selectedTileType={selectedTileType}
              onClick={onBoardClick}
            />
          );
        })}
      </div>
    </div>

    {toast && (
      <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 theme-panel-strong px-6 py-3 rounded-full shadow-2xl z-[60] animate-fade-in font-medium text-sm md:text-base whitespace-nowrap">
        {toast}
      </div>
    )}
  </div>
);
