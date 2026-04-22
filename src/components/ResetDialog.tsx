import { RotateCcw } from 'lucide-react'
import React from 'react'

interface ResetDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  onConfirm: () => void
}

export const ResetDialog: React.FC<ResetDialogProps> = ({
  dialogRef,
  onConfirm
}) => {
  return (
    <dialog
      ref={dialogRef}
      className='
        fixed inset-0 m-auto flex-col items-center justify-center rounded-3xl
        border border-slate-700 bg-slate-800 p-8 text-white shadow-2xl
        backdrop:bg-slate-900/80 backdrop:backdrop-blur-sm
        open:flex
      '
    >
      <div className='flex max-w-xs flex-col items-center gap-6'>
        <div className='rounded-full bg-red-500/20 p-4'>
          <RotateCcw size={48} className='text-red-400' />
        </div>
        <div className='text-center'>
          <h3 className='mb-2 text-2xl font-bold'>Reset Level?</h3>
          <p className='text-sm text-slate-400'>
            This will clear the entire board and return all tiles to your
            inventory.
          </p>
        </div>
        <div className='flex w-full gap-4'>
          <button
            onClick={() => dialogRef.current?.close()}
            className='
              flex-1 rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold
              transition-colors
              hover:bg-slate-600
            '
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className='
              flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold shadow-lg
              shadow-red-900/20 transition-colors
              hover:bg-red-500
            '
          >
            Reset
          </button>
        </div>
      </div>
    </dialog>
  )
}
