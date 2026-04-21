import React, { useEffect, useState } from 'react'

interface ProgressBarProps {
  isLoading: boolean;
}

const TRANSITION_MS = 200

/**
 * ProgressBar Component
 *
 * A simple, prop-driven progress bar that trickles while loading
 * and snaps/fades when finished.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ isLoading }) => {
  const [progress, setProgress] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading)

  // Synchronously reset state when loading starts.
  // Setting progress to 0 here ensures that we start from a clean baseline.
  if (isLoading && !prevIsLoading) {
    setPrevIsLoading(true)
    setIsFading(false)
    setProgress(0)
  }

  useEffect(() => {
    let trickle: ReturnType<typeof setInterval>
    let resetTimer: ReturnType<typeof setTimeout>

    // Coordination in a microtask to avoid cascading render warnings
    const coordinationTimer = setTimeout(() => {
      if (isLoading) {
        // If we just started (progress is 0), jump to 20 to trigger the slide-in
        if (progress === 0) {
          setProgress(20)
        }

        trickle = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) return prev
            const remaining = 90 - prev
            return prev + (remaining / 10) * Math.random()
          })
        }, 200)
      } else if (prevIsLoading) {
        // Simultaneous completion sequence: snap to 100% and start fade out
        setPrevIsLoading(false)
        setProgress(100)
        setIsFading(true)

        // Reset after the simultaneous animation completes (SSOT)
        resetTimer = setTimeout(() => {
          setProgress(0)
          setIsFading(false)
        }, TRANSITION_MS)
      }
    }, 0)

    return () => {
      clearTimeout(coordinationTimer)
      if (trickle) clearInterval(trickle)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [isLoading, prevIsLoading, progress])

  const isVisible = isLoading || isFading || progress > 0
  if (!isVisible) return null

  // We only suppress transitions when progress is exactly 0 (the reset/baseline).
  // This allows the slide-in from 0 to 20 and the snap from ~90 to 100.
  const isResetting = progress === 0

  return (
    <div
      className={`
        fixed inset-x-0 top-0 z-100 h-1 w-full overflow-hidden bg-transparent
        ${isFading ? 'opacity-0 transition-opacity' : 'opacity-100 transition-none'}
      `}
      style={{ transitionDuration: `${TRANSITION_MS}ms` }}
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
          transitionDuration: `${TRANSITION_MS}ms`
        }}
      />
    </div>
  )
}
