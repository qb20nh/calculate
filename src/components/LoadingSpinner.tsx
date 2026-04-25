import type { FunctionalComponent } from "preact";

interface LoadingSpinnerProps {
  isVisible?: boolean;
}

export const LoadingSpinner: FunctionalComponent<LoadingSpinnerProps> = ({ isVisible = true }) => {
  if (!isVisible) return null;

  return (
    <output
      aria-label="Loading screen"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-50/50"
    >
      <div className="size-16 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-600" />
    </output>
  );
};
