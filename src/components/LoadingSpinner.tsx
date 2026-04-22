import React from 'react'

/**
 * LoadingSpinner Component
 *
 * A centered, animated spinner with a backdrop blur.
 */
export const LoadingSpinner: React.FC<{ isVisible?: boolean }> = ({
  isVisible = true
}) => {
  if (!isVisible) return null
  return (
    <div className='
      fixed inset-0 z-50 flex items-center justify-center bg-slate-900
    '
    >
      <div className='
        size-16 animate-spin rounded-full border-4 border-blue-500/20
        border-t-blue-500
      '
      />
    </div>
  )
}
