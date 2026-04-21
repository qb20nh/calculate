import React from 'react';
import { HoverTarget } from '../types/game';
import { Tile } from './Tile';

interface InventoryProps {
    groupedInventory: { char: string; count: number }[];
    hoverTarget: HoverTarget | null;
    onStartDrag: (e: React.PointerEvent, item: any) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ groupedInventory, hoverTarget, onStartDrag }) => {
    return (
        <div data-dropzone="inventory" className={`w-full max-w-3xl bg-slate-800/50 p-6 rounded-t-3xl border-t transition-colors mt-auto ${hoverTarget?.type === 'inventory' ? 'border-blue-400 bg-slate-800' : 'border-slate-700'}`}>
            <div className="flex justify-between items-end mb-4">
                <span className="text-slate-400 font-medium">Your Tiles (Drag or Click)</span>
            </div>
            <div className="flex flex-wrap gap-4 pt-2 min-h-[80px]">
                {groupedInventory.map((grp) => (
                    <Tile
                        key={grp.char}
                        char={grp.char}
                        count={grp.count}
                        onPointerDown={(e) => onStartDrag(e, { source: 'inventory', char: grp.char })}
                    />
                ))}
                {groupedInventory.length === 0 && <span className="text-slate-500 italic mt-2">All tiles placed.</span>}
            </div>
        </div>
    );
};
