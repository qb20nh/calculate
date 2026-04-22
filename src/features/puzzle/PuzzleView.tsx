import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import React from 'react'

import { DragGhost } from '@/components/DragGhost'
import { ResetDialog } from '@/components/ResetDialog'
import { getGroupedTiles } from '@/domain/engine'
import { useDragAndDrop } from '@/hooks/useDragAndDrop'
import { usePuzzleGame } from '@/hooks/usePuzzleGame'
import { useRouter } from '@/hooks/useRouter'

import { Grid } from './Grid'
import { Inventory } from './Inventory'

interface PuzzleViewProps {
  showToast: (msg: string, type?: string) => void
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({ showToast }) => {
  const { navigate } = useRouter()
  const {
    levelIndex,
    setLevelIndex,
    maxProgress,
    currentLevelData,
    grid,
    inventory,
    isLevelCleared,
    isNewClear,
    setIsNewClear,
    resetLevel,
    handleDrop,
    handleQuickClick
  } = usePuzzleGame(showToast)

  const { dragInfo, hoverTarget, startDrag } = useDragAndDrop(
    handleDrop,
    handleQuickClick
  )

  const resetDialogRef = React.useRef<HTMLDialogElement>(null)

  const handleResetConfirm = () => {
    resetLevel()
    resetDialogRef.current?.close()
  }

  if (!currentLevelData) return null

  const groupedInventory = getGroupedTiles(inventory)
  const isGridEmpty = grid.every((cell) => !cell.char)

  return (
    <div className='
      flex h-screen flex-col items-center overflow-hidden bg-slate-900 px-4 pt-8
      text-white
    '
    >
      <div className='mb-8 flex w-full max-w-4xl items-start justify-between'>
        <button
          onClick={() => {
            void navigate('menu')
          }}
          className='
            mt-1 rounded-full p-2 transition-colors
            hover:bg-slate-800
          '
        >
          <ArrowLeft size={28} />
        </button>

        <div className='flex flex-col items-center'>
          <div className='flex items-center gap-6'>
            <button
              onClick={() => setLevelIndex(levelIndex - 1)}
              disabled={levelIndex === 0}
              className='
                rounded-lg p-1 transition-all
                hover:bg-slate-800
                disabled:opacity-10
              '
              title='Previous Level'
            >
              <ChevronLeft size={40} />
            </button>

            <h2 className='text-4xl font-black tracking-tight'>
              {currentLevelData.displayTitle}
            </h2>

            <button
              onClick={() => {
                setIsNewClear(false)
                setLevelIndex(levelIndex + 1)
              }}
              disabled={!isLevelCleared && levelIndex >= maxProgress}
              className={`
                rounded-lg p-1 transition-all
                ${
                isNewClear
                  ? `
                    bg-blue-600 text-white shadow-lg shadow-blue-500/30
                    hover:bg-blue-500
                  `
                  : isLevelCleared || levelIndex < maxProgress
                    ? 'hover:bg-slate-800'
                    : 'disabled:opacity-10'
              }
              `}
              title='Next Level'
            >
              <ChevronRight size={40} />
            </button>
          </div>
          {currentLevelData.displaySubtitle && (
            <p className='
              mt-2 text-xs font-bold tracking-widest text-blue-400 uppercase
              opacity-80
            '
            >
              {currentLevelData.displaySubtitle}
            </p>
          )}
        </div>

        <button
          onClick={() => resetDialogRef.current?.showModal()}
          disabled={isGridEmpty}
          className='
            mt-1 rounded-full p-2 transition-colors
            hover:bg-slate-800
            disabled:opacity-10
          '
          title='Reset Level'
        >
          <RotateCcw size={28} />
        </button>
      </div>

      <div className='
        flex w-full max-w-full flex-1 flex-col items-center justify-center
        overflow-hidden pb-8
      '
      >
        <p className='mb-8 max-w-lg shrink-0 text-center text-slate-400'>
          {currentLevelData.description}
        </p>
        <Grid
          grid={grid}
          cols={currentLevelData.cols}
          hoverTarget={hoverTarget}
          dragInfo={dragInfo}
          onStartDrag={startDrag}
        />
      </div>

      <Inventory
        groupedInventory={groupedInventory}
        hoverTarget={hoverTarget}
        onStartDrag={startDrag}
      />

      <DragGhost dragInfo={dragInfo} />

      <ResetDialog dialogRef={resetDialogRef} onConfirm={handleResetConfirm} />
    </div>
  )
}
