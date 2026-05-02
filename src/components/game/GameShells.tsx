import type { FunctionalComponent } from "preact";
import { StageHeader } from "@/components/game/StageHeader";
import { useAppSettings } from "@/lib/appSettings";
import type { GameMode } from "@/services/storage";

export const UnavailableLevelShell: FunctionalComponent<{
  difficulty: GameMode;
  requestedStage: number;
  availableStage: number;
  notice: string;
  onBack: () => void;
  onStageChange: (newStage: number) => void;
  onReset: () => void;
  onLatestAvailable: () => void;
}> = ({
  difficulty,
  requestedStage,
  availableStage,
  notice,
  onBack,
  onStageChange,
  onReset,
  onLatestAvailable,
}) => {
  const { copy, t } = useAppSettings();

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-transparent">
      <StageHeader
        difficulty={difficulty}
        stage={requestedStage}
        maxStage={Math.max(requestedStage, availableStage)}
        status="won"
        onBack={onBack}
        onStageChange={onStageChange}
        onReset={onReset}
      />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="theme-panel max-w-md w-full rounded-3xl p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black tracking-tight">
            {t("game.stageLockedTitle", { stage: requestedStage })}
          </h1>
          <p className="mt-3 theme-muted-text font-normal">{notice}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-2xl border theme-border px-5 py-3 font-bold theme-muted-text transition hover:bg-black/5 active:scale-95"
            >
              {copy.game.backToMenu}
            </button>
            <button
              type="button"
              onClick={onLatestAvailable}
              className="flex-1 rounded-2xl theme-primary-bg px-5 py-3 font-bold text-white shadow-xl transition active:scale-95"
            >
              {t("game.goToStage", { stage: availableStage })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GameLoadingShell: FunctionalComponent<{
  difficulty: GameMode;
  stage: number;
  maxStage: number;
  notice?: string | undefined;
  onBack: () => void;
  onStageChange: (newStage: number) => void;
}> = ({ difficulty, stage, maxStage, notice, onBack, onStageChange }) => {
  const { copy } = useAppSettings();

  return (
    <div className="theme-page-bg h-dvh w-full flex flex-col overflow-hidden">
      <div id="skeleton-progress" className="route-progress">
        <div className="route-progress-bar" style={{ width: "0%" }} />
      </div>
      <StageHeader
        difficulty={difficulty}
        stage={stage}
        maxStage={maxStage}
        onBack={onBack}
        onStageChange={onStageChange}
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center font-bold theme-muted-text">
        <div id="skeleton-spinner" className="flex items-center justify-center">
          <div className="size-16 animate-spin rounded-full border-4 theme-spinner" />
        </div>
        {notice && (
          <p className="max-w-xs rounded-2xl theme-operator-bg-soft theme-operator-text px-5 py-3 text-sm border theme-operator-border">
            {notice}
          </p>
        )}
        <p data-skeleton-loading-text>{copy.game.generatingPuzzle}</p>
      </div>
    </div>
  );
};
