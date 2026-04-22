import React from 'react'

import { ProgressBarProps, useProgressBar } from '../hooks/useProgressBar'

/**
 * ProgressBar Component
 *
 * A simple, prop-driven progress bar that trickles while loading
 * and snaps/fades when finished.
 */
export const ProgressBar: React.FC<ProgressBarProps> = (props) => {
  const { progress, isFading, isVisible, isResetting, transitionMs } =
    useProgressBar(props)

  if (!isVisible) return null

  return (
    <div
      className={`
        fixed inset-x-0 top-0 z-100 h-1 w-full overflow-hidden bg-transparent
        ${
        isFading
          ? 'opacity-0 transition-opacity'
          : 'opacity-100 transition-none'
      }
      `}
      style={{ transitionDuration: `${transitionMs}ms` }}
    >
      <div
        className={`
          h-full bg-linear-to-r from-blue-600 via-blue-400 to-cyan-300
          shadow-[0_0_10px_rgba(59,130,246,0.8),0_0_20px_rgba(34,211,238,0.4)]
          ease-out
          ${
          isResetting ? 'transition-none' : 'transition-all'
        }
        `}
        style={{
          width: `${progress}%`,
          transitionDuration: `${transitionMs}ms`
        }}
      />
    </div>
  )
}
