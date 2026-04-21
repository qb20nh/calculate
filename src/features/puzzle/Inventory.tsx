import React from 'react'

import { Tile } from '@/components/Tile'
import { DragItem, HoverTarget } from '@/domain/types'

interface InventoryProps {
  groupedInventory: {
    char: string;
    count: number
  }[];
  hoverTarget: HoverTarget | null;
  onStartDrag: (e: React.PointerEvent, item: DragItem) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ groupedInventory, hoverTarget, onStartDrag }) => {
  return (
    <div
      data-dropzone='inventory' className={`
        mt-auto w-full max-w-3xl rounded-t-3xl border-t bg-slate-800/50 p-6
        transition-colors
        ${hoverTarget?.type === 'inventory'
? 'border-blue-400 bg-slate-800'
: 'border-slate-700'}
      `}
    >
      <div className='mb-4 flex items-end justify-between'>
        <span className='font-medium text-slate-400'>Your Tiles (Drag or Click)</span>
      </div>
      <div className='flex min-h-[80px] flex-wrap gap-4 pt-2'>
        {groupedInventory.map((grp) => (
          <Tile
            key={grp.char}
            char={grp.char}
            count={grp.count}
            onPointerDown={(e) => onStartDrag(e, {
              source: 'inventory',
              char: grp.char
            })}
          />
        ))}
        {groupedInventory.length === 0 && <span className='mt-2 text-slate-500 italic'>All tiles placed.</span>}
      </div>
    </div>
  )
}
