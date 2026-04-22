import React from 'react'

import { DragInfo } from '@/domain/types'

import { Tile } from './Tile'

interface DragGhostProps {
  dragInfo: DragInfo
}

export const DragGhost: React.FC<DragGhostProps> = ({ dragInfo }) => {
  if (!dragInfo.isDragging || !dragInfo.item) return null

  return (
    <div
      id='drag-ghost'
      className='pointer-events-none fixed z-100'
      style={{
        left: `${dragInfo.x - dragInfo.offsetX}px`,
        top: `${dragInfo.y - dragInfo.offsetY}px`
      }}
    >
      <Tile char={dragInfo.item.char} />
    </div>
  )
}
