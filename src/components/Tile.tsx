import React from 'react'

interface TileProps {
  char: string;
  count?: number;
  isFaded?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export const Tile: React.FC<TileProps> = ({ char, count, isFaded, onPointerDown }) => {
  const isOperator = ['+', '−', '×', '÷'].includes(char)
  const isComparator = ['=', '<', '>'].includes(char)

  return (
    <div
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
      className={`
        relative flex size-10 cursor-grab items-center justify-center rounded-lg
        border-2 text-2xl font-bold shadow-sm transition-all duration-200
        select-none
        active:cursor-grabbing
        sm:size-14
        ${isOperator
          ? 'border-orange-200 bg-orange-100 text-orange-600'
          : isComparator
            ? 'border-blue-200 bg-blue-100 text-blue-600'
            : 'border-slate-200 bg-white text-slate-800'}
        ${isFaded
          ? 'scale-95 opacity-30'
          : `
            z-10
            hover:scale-105 hover:shadow-md
          `}
      `}
    >
      {char}
      {count !== undefined && count > 1 && (
        <div className='
          absolute -top-2 -right-2 z-20 flex size-6 items-center justify-center
          rounded-full border-2 border-slate-600 bg-slate-900 text-xs font-bold
          text-yellow-400 shadow-sm
        '
        >
          {count}
        </div>
      )}
    </div>
  )
}
