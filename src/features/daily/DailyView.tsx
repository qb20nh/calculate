import { ArrowLeft, Calendar, RotateCcw, Trophy } from 'lucide-react'
import React from 'react'

import { DragGhost } from '../../components/DragGhost'
import { Tile } from '../../components/Tile'
import { getGroupedTiles } from '../../domain/engine'
import { useDailyChallenge } from '../../hooks/useDailyChallenge'
import { useDailyTimer } from '../../hooks/useDailyTimer'
import { useDragAndDrop } from '../../hooks/useDragAndDrop'

interface DailyViewProps {
  onBack: () => void;
  showToast: (msg: string, type?: string) => void;
}

export const DailyView: React.FC<DailyViewProps> = ({ onBack, showToast }) => {
  const {
    dailyPool, dailyCurrent, dailySubmitted,
    submitStatement, handleDrop, handleQuickClick, clearBuilder
  } = useDailyChallenge(showToast)

  const { dragInfo, hoverTarget, startDrag } = useDragAndDrop(handleDrop, handleQuickClick)
  const timeLeft = useDailyTimer(true)

  const formattedDate = React.useMemo(() => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), [])
  const groupedDailyPool = getGroupedTiles(dailyPool)

  return (
    <div className='
      flex h-screen flex-col items-center overflow-hidden bg-slate-900 px-4 pt-8
      text-white
    '
    >
      <div className='mb-4 flex w-full max-w-4xl items-center justify-between'>
        <button
          onClick={onBack} className='
            rounded-full p-2 transition-colors
            hover:bg-slate-800
          '
        >
          <ArrowLeft size={28} />
        </button>
        <div className='text-center'>
          <h2 className='
            flex items-center justify-center gap-2 text-2xl font-bold
          '
          >
            <Calendar className='text-emerald-400' /> Daily Challenge
          </h2>
          <div className='mt-1 flex items-center justify-center gap-3'>
            <span className='text-sm font-medium text-slate-400'>
              {formattedDate}
            </span>
            <span className='text-slate-600'>•</span>
            <span className='
              rounded-sm bg-emerald-500/10 px-2 py-0.5 font-mono text-sm
              font-bold text-emerald-400
            '
            >
              {timeLeft} left
            </span>
          </div>
        </div>
        <div className='w-10' />
      </div>

      <div className='
        flex w-full flex-1 flex-col items-center overflow-auto px-4 pb-12
      '
      >
        <p className='mb-8 max-w-lg text-center text-slate-400'>
          Drag and drop tiles to build unique true statements.
        </p>

        {/* Builder Area */}
        <div className='
          mb-8 w-full max-w-2xl rounded-2xl bg-slate-800 p-6 shadow-xl
        '
        >
          <div className='mb-2 text-sm text-slate-400'>Statement Builder:</div>
          <div
            data-dropzone='builder'
            className={`
              mb-6 flex min-h-[80px] flex-wrap items-center gap-2 rounded-xl
              border bg-slate-900 p-4 shadow-inner transition-colors
              ${hoverTarget?.type === 'builder'
? 'border-emerald-500/50'
: 'border-slate-700'}
            `}
          >
            {dailyCurrent.map((tile, idx) => {
              const isBeingDragged = dragInfo.item?.source === 'builder' && dragInfo.item?.index === idx
              return (
                <div
                  key={tile.id}
                  data-dropzone='builder'
                  data-index={idx}
                  className='relative flex items-center justify-center'
                >
                  <Tile
                    char={tile.char}
                    isFaded={isBeingDragged}
                    onPointerDown={(e) => startDrag(e, { source: 'builder', index: idx, char: tile.char })}
                  />
                </div>
              )
            })}
            {dailyCurrent.length === 0 && <span className='pointer-events-none ml-2 text-slate-600 italic'>Drag tiles here...</span>}
          </div>

          <div className='flex items-center justify-between'>
            <button
              onClick={clearBuilder} className='
                flex items-center gap-1 text-slate-400 transition-colors
                hover:text-white
              '
            >
              <RotateCcw size={16} /> Clear
            </button>
            <button
              onClick={submitStatement}
              className='
                rounded-xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg
                transition-transform
                hover:scale-105 hover:bg-blue-500
                active:scale-95
                disabled:opacity-50
              '
              disabled={dailyCurrent.length === 0}
            >
              Submit Statement
            </button>
          </div>
        </div>

        {/* Pool Area */}
        <div
          data-dropzone='pool' className={`
            mb-12 w-full max-w-2xl p-4 transition-colors
            ${hoverTarget?.type === 'pool' ? 'rounded-xl bg-slate-800/30' : ''}
          `}
        >
          <div className='mb-2 text-sm text-slate-400'>Today's Pool:</div>
          <div className='flex flex-wrap gap-4 pt-2'>
            {groupedDailyPool.map((grp) => (
              <Tile
                key={grp.char}
                char={grp.char}
                count={grp.count}
                onPointerDown={(e) => startDrag(e, { source: 'pool', char: grp.char })}
              />
            ))}
          </div>
        </div>

        {/* Discovered List */}
        <div className='
          mb-12 w-full max-w-2xl rounded-2xl border border-slate-700
          bg-slate-800/50 p-6
        '
        >
          <h3 className='mb-4 flex items-center gap-2 text-xl font-bold'><Trophy className='text-yellow-400' /> Discovered Statements ({dailySubmitted.length})</h3>
          {dailySubmitted.length === 0
            ? (
              <p className='text-slate-500 italic'>No statements found yet. Get calculating!</p>
              )
            : (
              <div className='flex flex-col gap-3'>
                {dailySubmitted.map((stmt) => (
                  <div
                    key={stmt} className='
                      rounded-lg border border-slate-600 bg-slate-800 px-4 py-3
                      font-mono text-xl tracking-widest text-emerald-300
                      shadow-sm
                    '
                  >
                    {stmt}
                  </div>
                ))}
              </div>
              )}
        </div>
      </div>

      <DragGhost dragInfo={dragInfo} />
    </div>
  )
}
