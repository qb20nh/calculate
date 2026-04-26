import { useEffect, useRef, useState } from "preact/hooks";
import { getNextTrickleProgress } from "../lib/progressLogic";

export interface ProgressBarProps {
  /** Whether the progress bar should be in a loading state. */
  isLoading: boolean;
  /** Duration of the visual transitions in milliseconds. Default: 200 */
  transitionMs?: number;
  /** Frequency of progress updates during trickle in milliseconds. Default: 200 */
  trickleMs?: number;
}

declare global {
  interface Window {
    __INITIAL_PROGRESS__?: number;
    __PROGRESS_INTERVAL__?: number;
  }
}

/**
 * Custom hook to manage progress bar state, trickle animation, and fade-out sequences.
 */
export const useProgressBar = (props: ProgressBarProps) => {
  const { isLoading, transitionMs = 200, trickleMs = 200 } = props;

  const [progress, setProgress] = useState(() => {
    if (typeof window !== "undefined" && window.__INITIAL_PROGRESS__) {
      return window.__INITIAL_PROGRESS__;
    }
    return 0;
  });
  const [isFading, setIsFading] = useState(false);
  const wasLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (typeof window !== "undefined" && window.__PROGRESS_INTERVAL__) {
      clearInterval(window.__PROGRESS_INTERVAL__);
      delete window.__PROGRESS_INTERVAL__;
    }

    const wasLoading = wasLoadingRef.current;
    let trickle: ReturnType<typeof setInterval> | undefined;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    // Coordination in a microtask to avoid cascading render warnings from synchronous setState calls.
    const coordinationTimer = setTimeout(() => {
      if (isLoading) {
        if (!wasLoading) {
          setProgress(0);
          setIsFading(false);
        }

        // Only jump to 20 if we don't have any progress yet
        setProgress((prev) => (prev < 20 ? 20 : prev));
        trickle = setInterval(() => setProgress(getNextTrickleProgress), trickleMs);
        wasLoadingRef.current = true;
      } else if (wasLoading) {
        // Simultaneous completion sequence: snap to 100% and start fade out
        setProgress(100);
        setIsFading(true);

        // Reset after the simultaneous animation completes
        resetTimer = setTimeout(() => {
          setProgress(0);
          setIsFading(false);
          wasLoadingRef.current = false;
        }, transitionMs);
      } else {
        wasLoadingRef.current = false;
      }
    }, 0);

    return () => {
      clearTimeout(coordinationTimer);
      if (trickle) clearInterval(trickle);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [isLoading, transitionMs, trickleMs]);

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
