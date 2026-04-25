import type { FunctionalComponent } from "preact";
import { type ProgressBarProps, useProgressBar } from "@/hooks/useProgressBar";
import { cn } from "@/lib/utils";

/**
 * ProgressBar Component
 *
 * A simple, prop-driven progress bar that trickles while loading
 * and snaps/fades when finished.
 */
export const ProgressBar: FunctionalComponent<ProgressBarProps> = (props) => {
  const { progress, isFading, isVisible, isResetting, transitionMs } = useProgressBar(props);

  if (!isVisible) return null;

  return (
    <progress
      aria-label="Loading"
      max={100}
      value={progress}
      className={cn(
        "route-progress fixed inset-x-0 top-0 z-[100] h-1 w-full overflow-hidden border-0 bg-transparent appearance-none",
        isFading ? "opacity-0 transition-opacity" : "opacity-100 transition-none",
        isResetting ? "route-progress-resetting" : undefined,
      )}
      style={{ transitionDuration: `${transitionMs}ms` }}
    />
  );
};
