import React from 'react'

import { Tile } from '@/components/Tile'
import { DragInfo, DragItem, GridCell, HoverTarget } from '@/domain/types'

interface GridProps {
  grid: GridCell[];
  cols: number;
  hoverTarget: HoverTarget | null;
  dragInfo: DragInfo;
  onStartDrag: (e: React.PointerEvent, item: DragItem) => void;
}

export const Grid: React.FC<GridProps> = ({ grid, cols, hoverTarget, dragInfo, onStartDrag }) => {
  return (
    <div className='
      flex w-full max-w-full items-center justify-center overflow-auto px-4
    '
    >
      <div
        className='relative shrink-0'
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}
      >
        {grid.map((cell, idx) => {
          const char = cell.char
          if (cell.type === 'block') return <div key={cell.id} />

          const isHovered = hoverTarget?.type === 'grid' && hoverTarget.index === idx
          const isBeingDragged = dragInfo.item?.source === 'grid' && dragInfo.item?.index === idx

          return (
            <div
              key={cell.id}
              data-dropzone='grid'
              data-index={idx}
              className={`
                relative flex size-12 items-center justify-center rounded-xl
                transition-all
                sm:size-16
                ${isHovered
? 'z-10 scale-105 bg-slate-600 ring-4 ring-blue-400'
: 'bg-slate-700/30 shadow-inner'}
              `}
            >
              {char && !isBeingDragged && (
                <Tile char={char} onPointerDown={(e) => onStartDrag(e, { source: 'grid', index: idx, char })} />
              )}
              {isBeingDragged && (
                <div className='
                  size-10 rounded-lg border-2 border-dashed border-slate-500
                  bg-slate-600/50
                  sm:size-14
                '
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
