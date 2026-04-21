import React from 'react';
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Grid } from './Grid';
import { Inventory } from './Inventory';
import { usePuzzleGame } from '../../hooks/usePuzzleGame';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { getGroupedTiles } from '../../domain/engine';
import { ResetDialog } from '../../components/ResetDialog';
import { DragGhost } from '../../components/DragGhost';

interface PuzzleViewProps {
    onBack: () => void;
    showToast: (msg: string, type?: string) => void;
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({ onBack, showToast }) => {
    const {
        levelIndex, setLevelIndex,
        maxProgress,
        currentLevelData,
        grid, inventory,
        isLevelCleared, isNewClear, setIsNewClear,
        resetLevel,
        handleDrop, handleQuickClick
    } = usePuzzleGame(showToast);

    const { dragInfo, hoverTarget, startDrag } = useDragAndDrop(handleDrop, handleQuickClick);

    const resetDialogRef = React.useRef<HTMLDialogElement>(null);

    const handleResetConfirm = () => {
        resetLevel();
        resetDialogRef.current?.close();
    };

    if (!currentLevelData) return null;

    const groupedInventory = getGroupedTiles(inventory);
    const isGridEmpty = grid.every(cell => !cell.char);

    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col items-center pt-8 px-4 overflow-hidden">
            <div className="w-full max-w-4xl flex justify-between items-start mb-8">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors mt-1">
                    <ArrowLeft size={28} />
                </button>
                
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => setLevelIndex(levelIndex - 1)} 
                            disabled={levelIndex === 0}
                            className="p-1 hover:bg-slate-800 rounded-lg disabled:opacity-10 transition-all"
                            title="Previous Level"
                        >
                            <ChevronLeft size={40} />
                        </button>
                        
                        <h2 className="text-4xl font-black tracking-tight">{currentLevelData.displayTitle}</h2>
                        
                        <button 
                            onClick={() => {
                                setIsNewClear(false);
                                setLevelIndex(levelIndex + 1);
                            }} 
                            disabled={!isLevelCleared && levelIndex >= maxProgress}
                            className={`p-1 rounded-lg transition-all ${isNewClear ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30' : (isLevelCleared || levelIndex < maxProgress) ? 'hover:bg-slate-800' : 'disabled:opacity-10'}`}
                            title="Next Level"
                        >
                            <ChevronRight size={40} />
                        </button>
                    </div>
                    {currentLevelData.displaySubtitle && (
                        <p className="text-blue-400 mt-2 font-bold tracking-widest uppercase text-xs opacity-80">
                            {currentLevelData.displaySubtitle}
                        </p>
                    )}
                </div>

                <button 
                    onClick={() => resetDialogRef.current?.showModal()} 
                    disabled={isGridEmpty}
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors mt-1 disabled:opacity-10" 
                    title="Reset Level"
                >
                    <RotateCcw size={28} />
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-full overflow-hidden pb-8">
                <p className="text-slate-400 mb-8 max-w-lg text-center flex-shrink-0">{currentLevelData.description}</p>
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
    );
};
