import React from 'react';

interface TileProps {
    char: string;
    count?: number;
    isFaded?: boolean;
    onPointerDown?: (e: React.PointerEvent) => void;
}

export const Tile: React.FC<TileProps> = ({ char, count, isFaded, onPointerDown }) => {
    const isOperator = ['+', '−', '×', '÷'].includes(char);
    const isComparator = ['=', '<', '>'].includes(char);

    return (
        <div
            onPointerDown={onPointerDown}
            style={{ touchAction: 'none' }}
            className={`relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg shadow flex items-center justify-center text-2xl font-bold cursor-grab active:cursor-grabbing select-none transition-all duration-200
        ${isFaded ? 'opacity-30 scale-95' : 'hover:scale-105 hover:shadow-md z-10'}
        ${isOperator ? 'bg-orange-100 text-orange-600 border-orange-200' :
                    isComparator ? 'bg-blue-100 text-blue-600 border-blue-200' :
                        'bg-white text-slate-800 border-slate-200'} border-2`}
        >
            {char}
            {count !== undefined && count > 1 && (
                <div className="absolute -top-2 -right-2 bg-slate-900 text-yellow-400 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-600 shadow-sm z-20">
                    {count}
                </div>
            )}
        </div>
    );
};
