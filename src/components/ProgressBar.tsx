import React, { useEffect, useState } from 'react'

interface ProgressBarProps {
  isLoading: boolean;
}

/**
 * The frequency (in ms) of progress updates during the loading phase.
 * A lower value makes the "trickle" feel more continuous.
 */
const TRICKLE_INTERVAL_MS = 250

/**
 * The duration (in ms) of the final exit sequence.
 * This controls both the 100% snap animation and the fade-out opacity transition.
 */
const EXIT_ANIMATION_MS = 400

/**
 * ProgressBar Component
 *
 * A premium, prop-driven progress bar that:
 * 1. Pops in instantly and slides from 0 to 20% on start.
 * 2. "Trickles" progress while isLoading is true.
 * 3. Snaps to 100% and fades out simultaneously when finished.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ isLoading }) => {
  const [progress, setProgress] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading)

  // Synchronously reset state when a new navigation starts.
  // This ensures we always start from a clean baseline (0%) for the slide-in.
  if (isLoading && !prevIsLoading) {
    setPrevIsLoading(true)
    setIsFading(false)
    setProgress(0)
  }

  useEffect(() => {
    let trickle: ReturnType<typeof setInterval>
    let resetTimer: ReturnType<typeof setTimeout>

    // Use a microtask for state coordination to satisfy React's purity rules
    // while keeping transitions snappy.
    const coordinationTimer = setTimeout(() => {
      if (isLoading) {
        // Trigger the initial slide-in animation from 0 to 20%
        if (progress === 0) {
          setProgress(20)
        }

        // Periodically increment progress to keep the UI feeling "alive"
        trickle = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) return prev
            const remaining = 90 - prev
            // Increments faster as it gets closer to 90% (using 1/10th of remaining)
            return prev + (remaining / 10) * Math.random()
          })
        }, TRICKLE_INTERVAL_MS)
      } else if (prevIsLoading) {
        // LOADING COMPLETE: Perform the snap-to-100 and fade-out in parallel
        setPrevIsLoading(false)
        setProgress(100)
        setIsFading(true)

        // Reset the component state once the exit animations are finished.
        // The total time matches EXIT_ANIMATION_MS to keep the lifecycle clean.
        resetTimer = setTimeout(() => {
          setProgress(0)
          setIsFading(false)
        }, EXIT_ANIMATION_MS)
      }
    }, 0)

    return () => {
      clearTimeout(coordinationTimer)
      if (trickle) clearInterval(trickle)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [isLoading, prevIsLoading, progress])

  // Hide the component if it's not active, not fading, and has no progress to show.
  const isVisible = isLoading || isFading || progress > 0
  if (!isVisible) return null

  // Suppress transitions only when at 0% to avoid "backwards sliding"
  // during a reset or a fresh navigation start.
  const isResetting = progress === 0

  return (
    <div
      className={`
        fixed inset-x-0 top-0 z-100 h-1 w-full overflow-hidden bg-transparent
        ${isFading ? 'opacity-0 transition-opacity' : 'opacity-100 transition-none'}
      `}
      style={{ transitionDuration: `${EXIT_ANIMATION_MS}ms` }}
    >
      <div
        className={`
          h-full bg-linear-to-r from-blue-600 via-blue-400 to-cyan-300
          shadow-[0_0_10px_rgba(59,130,246,0.8),0_0_20px_rgba(34,211,238,0.4)]
          ease-out
          ${isResetting ? 'transition-none' : 'transition-all'}
        `}
        style={{
          width: `${progress}%`,
          transitionDuration: `${EXIT_ANIMATION_MS}ms`
        }}
      />
    </div>
  )
}
