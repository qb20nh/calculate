import { ChevronRight } from "lucide-preact";
import type { FunctionalComponent } from "preact";
import { useAppSettings } from "@/lib/appSettings";
import type { Difficulty, GameMode, Progress } from "@/services/storage";

interface MainMenuProps {
  onStart: (mode: GameMode) => void;
  onStartIntent?: (mode: GameMode) => void;
  progress: Progress;
}

export const MainMenu: FunctionalComponent<MainMenuProps> = ({
  onStart,
  onStartIntent,
  progress,
}) => {
  const { copy, t } = useAppSettings();
  const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];

  return (
    <div className="theme-page-bg h-dvh w-full flex flex-col items-center justify-center p-6">
      <div className="theme-panel menu-panel-intro max-w-md w-full rounded-3xl shadow-2xl p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-balance tracking-tight mb-2">
            {copy.menuTitleMain}{" "}
            <span className="text-[var(--theme-primary)]">{copy.menuTitleAccent}</span>
          </h1>
          <p className="theme-muted-text font-medium">{copy.menuSubtitle}</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-bold theme-muted-text uppercase tracking-widest ml-1 mb-2">
            {copy.selectDifficulty}
          </p>
          {difficulties.map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => onStart(diff)}
              onPointerEnter={() => onStartIntent?.(diff)}
              onPointerDown={() => onStartIntent?.(diff)}
              className="menu-difficulty-card group w-full flex items-center justify-between p-4 rounded-2xl border-2 theme-panel transition-all active:scale-95 text-left"
            >
              <div>
                <h2 className="text-lg font-bold">{copy.difficulty[diff]}</h2>
                <p className="text-sm theme-muted-text">
                  {t("difficultyDescription.Standard", { maxStage: progress[diff].max })}
                </p>
              </div>
              <div className="theme-btn-primary group-hover-theme-primary-bg p-2 rounded-full transition-colors">
                <ChevronRight className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onStart("Custom")}
            onPointerEnter={() => onStartIntent?.("Custom")}
            onPointerDown={() => onStartIntent?.("Custom")}
            className="menu-difficulty-card group w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed theme-panel transition-all active:scale-95 text-left"
          >
            <div>
              <h2 className="text-lg font-bold">{copy.difficulty.Custom}</h2>
              <p className="text-sm theme-muted-text">{copy.difficultyDescription.Custom}</p>
            </div>
            <div className="theme-btn-primary group-hover-theme-primary-bg p-2 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-white" strokeWidth={3} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
