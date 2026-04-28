import type { FunctionalComponent, RefObject } from "preact";
import type { BankGroup } from "@/components/game/gameUtils";
import { useAppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import type { TileData } from "@/services/math";

export const InventoryBank: FunctionalComponent<{
  groups: BankGroup[];
  selectedTileId: string | null;
  status: "playing" | "won";
  inventoryRef: RefObject<HTMLDivElement>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScroll: () => void;
  onSelectTile: (tileId: string | null) => void;
}> = ({
  groups,
  selectedTileId,
  status,
  inventoryRef,
  canScrollLeft,
  canScrollRight,
  onScroll,
  onSelectTile,
}) => {
  const { copy } = useAppSettings();

  return (
    <div className="theme-panel border-t shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] shrink-0 z-20 pb-safe">
      <div className="max-w-4xl mx-auto relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 theme-edge-fade-left pointer-events-none z-30" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 theme-edge-fade-right pointer-events-none z-30" />
        )}
        <div
          ref={inventoryRef}
          onScroll={onScroll}
          className="pt-4 px-8 pb-6 md:pt-6 md:pb-8 overflow-x-auto board-container flex flex-nowrap md:flex-wrap md:justify-center gap-3 md:gap-4"
          style={{ justifyContent: "safe center" }}
        >
          {groups.map((group) => {
            const isSelected =
              selectedTileId !== null &&
              group.tiles.some((tile: TileData) => tile.id === selectedTileId);
            const count = group.tiles.length;
            const firstTile = group.tiles[0];
            /* istanbul ignore next */
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
                    if (status !== "playing") return;
                    onSelectTile(isSelected ? null : firstTile.id);
                  }}
                  className={cn(
                    "tile w-11 h-11 text-xl md:text-2xl flex-shrink-0 relative z-10",
                    `tile-${group.type}`,
                    isSelected && "selected",
                  )}
                >
                  {group.val}
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
          {groups.length === 0 && (
            <div className="theme-muted-text font-medium italic py-3 px-4">
              {copy.game.bankEmpty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
