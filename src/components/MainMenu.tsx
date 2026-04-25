import { ChevronRight } from "lucide-preact";
import type { FunctionalComponent } from "preact";
import type { Difficulty, Progress } from "@/services/storage";

interface MainMenuProps {
  onStart: (difficulty: Difficulty) => void;
  onStartIntent?: (difficulty: Difficulty) => void;
  progress: Progress;
}

export const MainMenu: FunctionalComponent<MainMenuProps> = ({
  onStart,
  onStartIntent,
  progress,
}) => {
  const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-slate-100">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-2">
            Math <span>Crossword</span>
          </h1>
          <p className="text-slate-500 font-medium">Scrabble Edition</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">
            Select Difficulty
          </p>
          {difficulties.map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => onStart(diff)}
              onPointerEnter={() => onStartIntent?.(diff)}
              onPointerDown={() => onStartIntent?.(diff)}
              className="menu-difficulty-card group w-full flex items-center justify-between p-4 rounded-2xl border-2 hover:bg-slate-50 transition-all active:scale-95 text-left"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-700">{diff}</h3>
                <p className="text-sm text-slate-400">Max Stage: {progress[diff].max}</p>
              </div>
              <div className="theme-btn-primary group-hover-theme-primary-bg p-2 rounded-full transition-colors">
                <ChevronRight className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
