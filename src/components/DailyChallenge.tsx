import React from 'react';
import { ArrowLeft, Calendar, RotateCcw, Trophy } from 'lucide-react';
import { Tile } from './Tile';
import { TileItem, HoverTarget, DragInfo } from '../types/game';

interface DailyChallengeProps {
    dailyPool: TileItem[];
    dailyCurrent: TileItem[];
    dailySubmitted: string[];
    timeLeft: string;
    hoverTarget: HoverTarget | null;
    dragInfo: DragInfo;
    onBack: () => void;
    onStartDrag: (e: React.PointerEvent, item: any) => void;
    onClear: () => void;
    onSubmit: () => void;
    getGroupedTiles: (tiles: TileItem[]) => { char: string; count: number }[];
}

export const DailyChallenge: React.FC<DailyChallengeProps> = ({
    dailyPool,
    dailyCurrent,
    dailySubmitted,
    timeLeft,
    hoverTarget,
    dragInfo,
    onBack,
    onStartDrag,
    onClear,
    onSubmit,
    getGroupedTiles
}) => {
    const groupedDailyPool = getGroupedTiles(dailyPool);

    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col items-center pt-8 px-4 overflow-hidden">
            <div className="w-full max-w-4xl flex justify-between items-center mb-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft size={28} />
                </button>
                <div className="text-center">
                    <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                        <Calendar className="text-emerald-400" /> Daily Challenge
                    </h2>
                    <div className="flex items-center justify-center gap-3 mt-1">
                        <span className="text-slate-400 text-sm font-medium">
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-400 text-sm font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                            {timeLeft} left
                        </span>
                    </div>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 w-full overflow-auto flex flex-col items-center px-4 pb-12">
                <p className="text-slate-400 mb-8 max-w-lg text-center">
                    Drag and drop tiles to build unique true statements.
                </p>

                {/* Builder Area */}
                <div className="w-full max-w-2xl bg-slate-800 p-6 rounded-2xl shadow-xl mb-8">
                    <div className="text-sm text-slate-400 mb-2">Statement Builder:</div>
                    <div
                        data-dropzone="builder"
                        className={`min-h-[80px] bg-slate-900 rounded-xl p-4 flex flex-wrap gap-2 items-center mb-6 shadow-inner border transition-colors ${hoverTarget?.type === 'builder' ? 'border-emerald-500/50' : 'border-slate-700'}`}
                    >
                        {dailyCurrent.map((tile, idx) => {
                            const isBeingDragged = dragInfo.item?.source === 'builder' && dragInfo.item?.index === idx;
                            return (
                                <div
                                    key={tile.id}
                                    data-dropzone="builder"
                                    data-index={idx}
                                    className="relative flex items-center justify-center"
                                >
                                    <Tile
                                        char={tile.char}
                                        isFaded={isBeingDragged}
                                        onPointerDown={(e) => onStartDrag(e, { source: 'builder', index: idx, char: tile.char })}
                                    />
                                </div>
                            );
                        })}
                        {dailyCurrent.length === 0 && <span className="text-slate-600 italic ml-2 pointer-events-none">Drag tiles here...</span>}
                    </div>

                    <div className="flex justify-between items-center">
                        <button onClick={onClear} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                            <RotateCcw size={16} /> Clear
                        </button>
                        <button
                            onClick={onSubmit}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            disabled={dailyCurrent.length === 0}
                        >
                            Submit Statement
                        </button>
                    </div>
                </div>

                {/* Pool Area */}
                <div data-dropzone="pool" className={`w-full max-w-2xl mb-12 p-4 transition-colors ${hoverTarget?.type === 'pool' ? 'bg-slate-800/30 rounded-xl' : ''}`}>
                    <div className="text-sm text-slate-400 mb-2">Today's Pool:</div>
                    <div className="flex flex-wrap gap-4 pt-2">
                        {groupedDailyPool.map((grp) => (
                            <Tile
                                key={grp.char}
                                char={grp.char}
                                count={grp.count}
                                onPointerDown={(e) => onStartDrag(e, { source: 'pool', char: grp.char })}
                            />
                        ))}
                    </div>
                </div>

                {/* Discovered List */}
                <div className="w-full max-w-2xl bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-12">
                    <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Trophy className="text-yellow-400" /> Discovered Statements ({dailySubmitted.length})</h3>
                    {dailySubmitted.length === 0 ? (
                        <p className="text-slate-500 italic">No statements found yet. Get calculating!</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {dailySubmitted.map((stmt, idx) => (
                                <div key={idx} className="bg-slate-800 px-4 py-3 rounded-lg border border-slate-600 font-mono text-xl tracking-widest text-emerald-300 shadow">
                                    {stmt}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
