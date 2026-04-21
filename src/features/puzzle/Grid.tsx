import React from 'react';
import { GridCell, HoverTarget, DragInfo, DragItem } from '../../domain/types';
import { Tile } from '../../components/Tile';

interface GridProps {
    grid: GridCell[];
    cols: number;
    hoverTarget: HoverTarget | null;
    dragInfo: DragInfo;
    onStartDrag: (e: React.PointerEvent, item: DragItem) => void;
}

export const Grid: React.FC<GridProps> = ({ grid, cols, hoverTarget, dragInfo, onStartDrag }) => {
    return (
        <div className="w-full max-w-full overflow-auto flex justify-center items-center px-4">
            <div
                className="relative flex-shrink-0"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}
            >
                {grid.map((cell, idx) => {
                    const char = cell.char;
                    if (cell.type === 'block') return <div key={`grid-cell-${idx}`} />;

                    const isHovered = hoverTarget?.type === 'grid' && hoverTarget.index === idx;
                    const isBeingDragged = dragInfo.item?.source === 'grid' && dragInfo.item?.index === idx;

                    return (
                        <div
                            key={`grid-cell-${idx}`}
                            data-dropzone="grid"
                            data-index={idx}
                            className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-all 
                                ${isHovered ? 'ring-4 ring-blue-400 scale-105 bg-slate-600 z-10' : 'bg-slate-700/30 shadow-inner'}
                            `}
                        >
                            {char && !isBeingDragged && (
                                <Tile char={char} onPointerDown={(e) => onStartDrag(e, { source: 'grid', index: idx, char: char })} />
                            )}
                            {isBeingDragged && (
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border-2 border-dashed border-slate-500 bg-slate-600/50" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
