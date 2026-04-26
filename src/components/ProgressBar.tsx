import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
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

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.getElementById("skeleton-progress")?.remove();
      document.getElementById("skeleton-spinner")?.remove();
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className={cn(
        "route-progress fixed inset-x-0 top-0 z-[100] h-1 w-full overflow-hidden",
        isFading ? "opacity-0 transition-opacity" : "opacity-100 transition-none",
        isResetting ? "route-progress-resetting" : undefined,
      )}
    >
      <div
        className="h-full bg-primary transition-all ease-linear"
        style={{ width: `${progress}%`, transitionDuration: `${transitionMs}ms` }}
      />
    </div>
  );
};
