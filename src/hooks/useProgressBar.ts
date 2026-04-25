import { useEffect, useState } from "preact/hooks";

export interface ProgressBarProps {
  /** Whether the progress bar should be in a loading state. */
  isLoading: boolean;
  /** Duration of the visual transitions in milliseconds. Default: 200 */
  transitionMs?: number;
  /** Frequency of progress updates during trickle in milliseconds. Default: 200 */
  trickleMs?: number;
}

/**
 * Calculates the next progress value using a trickle effect.
 * Stays below 90% until explicitly finished.
 */
const getNextTrickleProgress = (prev: number) => {
  const remaining = Math.max(0, 90 - prev);
  return prev + (remaining / 10) * Math.random();
};

/**
 * Custom hook to manage progress bar state, trickle animation, and fade-out sequences.
 */
export const useProgressBar = (props: ProgressBarProps) => {
  const { isLoading, transitionMs = 200, trickleMs = 200 } = props;

  const [progress, setProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);

  // Synchronously reset state when loading starts to ensure we start from a clean baseline.
  if (isLoading && !prevIsLoading) {
    setPrevIsLoading(true);
    setIsFading(false);
    setProgress(0);
  }

  useEffect(() => {
    let trickle: ReturnType<typeof setInterval>;
    let resetTimer: ReturnType<typeof setTimeout>;

    // Coordination in a microtask to avoid cascading render warnings from synchronous setState calls.
    const coordinationTimer = setTimeout(() => {
      if (isLoading) {
        // Jump to 20 to trigger the initial slide-in if we're at the baseline
        setProgress((prev) => (prev === 0 ? 20 : prev));
        trickle = setInterval(() => setProgress(getNextTrickleProgress), trickleMs);
      } else if (prevIsLoading) {
        // Simultaneous completion sequence: snap to 100% and start fade out
        setProgress(100);
        setIsFading(true);

        // Reset after the simultaneous animation completes
        resetTimer = setTimeout(() => {
          setPrevIsLoading(false);
          setProgress(0);
          setIsFading(false);
        }, transitionMs);
      }
    }, 0);

    return () => {
      clearTimeout(coordinationTimer);
      if (trickle) clearInterval(trickle);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [isLoading, prevIsLoading, transitionMs, trickleMs]);

  const isVisible = isLoading || isFading || progress > 0;

  return {
    progress,
    isFading,
    isVisible,
    isResetting: progress === 0,
    transitionMs,
    trickleMs,
  };
};
