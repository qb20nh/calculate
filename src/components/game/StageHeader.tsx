import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-preact";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { useAppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import type { GameMode, GameState } from "@/services/storage";

const headerButtonClass =
  "p-2 theme-muted-text transition-colors rounded-full disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current";

const headerPillClass =
  "flex items-center theme-primary-bg-soft rounded-full shadow-inner theme-primary-border overflow-hidden";

const HeaderShell: FunctionalComponent<{
  left: ComponentChildren;
  centerDesktop: ComponentChildren;
  centerMobile: ComponentChildren;
  right: ComponentChildren;
}> = ({ left, centerDesktop, centerMobile, right }) => (
  <div className="flex justify-between items-center border-b border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 text-[var(--theme-ink)] sm:p-4 shadow-sm z-20 shrink-0 relative">
    <div className="flex items-center gap-2 sm:gap-3">
      {left}
      <div className="hidden sm:block h-8 w-[1px] theme-border-line mx-1" />
      <div className="hidden sm:block">{centerDesktop}</div>
    </div>

    <div className="sm:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {centerMobile}
    </div>

    {right}
  </div>
);

export const StageHeader: FunctionalComponent<{
  difficulty: GameMode;
  stage: number;
  maxStage: number;
  status?: GameState["status"];
  onBack: () => void;
  onStageChange: (newStage: number) => void;
  onReset?: () => void;
}> = ({ difficulty, stage, maxStage, status, onBack, onStageChange, onReset }) => {
  const { copy, t } = useAppSettings();
  const stageLabel =
    difficulty === "Custom"
      ? copy.difficulty.Custom
      : t("game.stageLabel", {
          difficulty: copy.difficulty[difficulty],
          stage,
        });
  const stageBar = (
    <div className={headerPillClass}>
      <button
        type="button"
        onClick={() => onStageChange(stage - 1)}
        disabled={stage <= 1}
        className={cn(
          headerButtonClass,
          "px-2 py-1 theme-primary-hover-text theme-primary-hover-bg",
          "transition-colors",
        )}
        aria-label={copy.game.previousStage}
        data-skeleton-button="previous"
      >
        <ChevronLeft width={16} height={16} strokeWidth={3} />
      </button>
      <span
        className="px-2 py-1 theme-primary-text text-sm font-bold whitespace-nowrap text-center min-w-[120px]"
        data-skeleton-title
      >
        {stageLabel}
      </span>
      <button
        type="button"
        onClick={() => onStageChange(stage + 1)}
        disabled={stage >= maxStage && status !== "won"}
        className={cn(
          headerButtonClass,
          "px-2 py-1 theme-primary-hover-text theme-primary-hover-bg",
          "transition-colors",
        )}
        aria-label={copy.game.nextStage}
        data-skeleton-button="next"
      >
        <ChevronRight width={16} height={16} strokeWidth={3} />
      </button>
    </div>
  );

  return (
    <HeaderShell
      left={
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.game.back}
          className={cn(headerButtonClass, "theme-primary-hover-text theme-primary-hover-bg")}
          data-skeleton-button="back"
        >
          <ChevronLeft width={20} height={20} strokeWidth={2.5} />
        </button>
      }
      centerDesktop={stageBar}
      centerMobile={stageBar}
      right={
        <button
          type="button"
          onClick={onReset}
          disabled={!onReset}
          className={cn(headerButtonClass, "theme-danger-text theme-danger-hover-bg")}
          aria-label={copy.game.resetStage}
          data-skeleton-button="reset"
        >
          <RotateCcw width={20} height={20} strokeWidth={2.5} />
        </button>
      }
    />
  );
};
