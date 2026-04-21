import React, { Suspense } from 'react'

interface PreloaderProps {
  isActive: boolean;
  isPreloaded: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Preloaded Pattern
 *
 * Manages the lifecycle of a lazy-loaded component by:
 * 1. Postponing mount until the view is either active or preloaded (on hover).
 * 2. Keeping the component mounted but hidden when inactive to preserve state and ensure instant re-entry.
 * 3. Providing a conditional fallback that only shows the loading state if the view is currently active.
 */
export const Preloader: React.FC<PreloaderProps> = ({
  isActive,
  isPreloaded,
  fallback,
  children
}) => {
  const shouldMount = isActive || isPreloaded

  if (!shouldMount) return null

  return (
    <Suspense fallback={isActive ? fallback : null}>
      <div className={isActive ? 'block' : 'hidden'} aria-hidden={!isActive}>
        {children}
      </div>
    </Suspense>
  )
}
