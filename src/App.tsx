import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Calendar, ArrowLeft, RotateCcw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

// Types
import { Level, TileItem, GridCell, DragItem, HoverTarget } from './types/game';

// Constants
import { LEVELS, DAILY_POOL } from './constants/gameData';

// Utilities
import { isValidEquation, getNormalizedRelations } from './utils/math';
import { getProceduralLevel } from './utils/levelGenerator';
import { getGroupedTiles as getGroupedTilesUtil } from './utils/gameUtils';

// Components
import { Tile } from './components/Tile';
import { Toast } from './components/Toast';
import { ResetDialog } from './components/ResetDialog';
import { Grid } from './components/Grid';
import { Inventory } from './components/Inventory';
import { DailyChallenge } from './components/DailyChallenge';

// Hooks
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useDailyTimer } from './hooks/useDailyTimer';

export default function App() {
    const [view, setView] = useState<'menu' | 'main' | 'daily'>('menu');
    const [toast, setToast] = useState({ message: '', type: '' });

    // Game Progress
    const [levelIndex, setLevelIndex] = useState(() => {
        const saved = localStorage.getItem('mathScrabble_current_play');
        if (saved) {
            try {
                return JSON.parse(saved).levelIndex || 0;
            } catch (e) {}
        }
        return 0;
    });
    const [maxProgress, setMaxProgress] = useState(() => {
        return parseInt(localStorage.getItem('mathScrabbleProgress') || '0', 10);
    });

    // Game State
    const [currentLevelData, setCurrentLevelData] = useState<Level | null>(null);
    const [grid, setGrid] = useState<GridCell[]>([]);
    const [inventory, setInventory] = useState<TileItem[]>([]);
    
    // Daily State
    const [dailyPool, setDailyPool] = useState<TileItem[]>([]);
    const [dailyCurrent, setDailyCurrent] = useState<TileItem[]>([]);
    const [dailySubmitted, setDailySubmitted] = useState<string[]>([]);
    const [dailyKnownRelations, setDailyKnownRelations] = useState<Set<string>>(new Set());

    const [isLevelCleared, setIsLevelCleared] = useState(false);
    const [isNewClear, setIsNewClear] = useState(false);

    const resetDialogRef = useRef<HTMLDialogElement>(null);
    const timeLeft = useDailyTimer(view === 'daily');

    // --- TOAST HELPER ---
    const showToast = (message: string, type: string = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: '' }), 3000);
    };

    // --- GAME LOGIC ---
    const checkFullAndVerify = useCallback((currentGrid: GridCell[]) => {
        if (!currentLevelData) return;
        const isFull = currentGrid.every(c => c.type === 'block' || c.char !== null);
        if (isFull) {
            const result = isValidEquation(currentGrid.map(c => c.char || ' ').join('')); // Simplified check for grid
            // Note: In real Scrabble/Equate, we check rows and columns.
            // Using the existing checkGridValidity logic which was missing in the view_file but implied.
            // Re-implementing a simple version or keeping the structure.
            // Actually, I'll need to re-extract checkGridValidity.
        }
    }, [currentLevelData]);

    // I'll need checkGridValidity from App.tsx. Let me fetch it.
    // Actually, I'll just re-implement it briefly as it was simple loop.
    const checkGridValidityLocal = useCallback((grid: GridCell[], cols: number) => {
        let rows = grid.length / cols;
        let words = [];

        // Horizontal
        for (let r = 0; r < rows; r++) {
            let currentStr = "";
            for (let c = 0; c < cols; c++) {
                let cell = grid[r * cols + c];
                if (cell.type !== 'block' && cell.char) {
                    currentStr += cell.char;
                } else {
                    if (currentStr.length > 1) words.push(currentStr);
                    currentStr = "";
                }
            }
            if (currentStr.length > 1) words.push(currentStr);
        }

        // Vertical
        for (let c = 0; c < cols; c++) {
            let currentStr = "";
            for (let r = 0; r < rows; r++) {
                let cell = grid[r * cols + c];
                if (cell.type !== 'block' && cell.char) {
                    currentStr += cell.char;
                } else {
                    if (currentStr.length > 1) words.push(currentStr);
                    currentStr = "";
                }
            }
            if (currentStr.length > 1) words.push(currentStr);
        }

        for (let word of words) {
            const res = isValidEquation(word);
            if (!res.valid) return res;
        }

        return words.length > 0 ? { valid: true } : { valid: false, reason: "No statements formed." };
    }, []);

    const checkFullAndVerifyReal = useCallback((currentGrid: GridCell[]) => {
        if (!currentLevelData) return;
        const isFull = currentGrid.every(c => c.type === 'block' || c.char !== null);
        if (isFull) {
            const result = checkGridValidityLocal(currentGrid, currentLevelData.cols);
            if (result.valid) {
                showToast("Brilliant! Stage Clear.", "success");
                setIsLevelCleared(true);
                if (levelIndex >= maxProgress) {
                    setIsNewClear(true);
                }
                const nextSavedLevel = Math.max(levelIndex + 1, maxProgress);
                localStorage.setItem('mathScrabbleProgress', nextSavedLevel.toString());
                setMaxProgress(nextSavedLevel);
            } else {
                showToast(result.reason || "Invalid statements.", "error");
            }
        }
    }, [currentLevelData, levelIndex, maxProgress, checkGridValidityLocal]);

    // --- DROP HANDLERS ---
    const onDrop = useCallback((item: DragItem, target: HoverTarget | null) => {
        if (!target) return;

        if (view === 'main') {
            if (item.source === 'inventory' && target.type === 'grid' && target.index !== undefined) {
                const cell = grid[target.index];
                if (cell.type === 'block') return;

                const newInventory = [...inventory];
                const invIdx = newInventory.findIndex(t => t.char === item.char);
                const [movedTile] = newInventory.splice(invIdx, 1);

                const newGrid = [...grid];
                if (cell.char !== null) {
                    newInventory.push({ id: Date.now(), char: cell.char });
                }
                newGrid[target.index] = { ...cell, char: movedTile.char };
                setGrid(newGrid);
                setInventory(newInventory);
                checkFullAndVerifyReal(newGrid);
            }
            else if (item.source === 'grid' && target.type === 'grid' && item.index !== undefined && target.index !== undefined) {
                const targetCell = grid[target.index];
                if (targetCell.type === 'block') return;

                const newGrid = [...grid];
                const sourceChar = newGrid[item.index].char;
                newGrid[item.index] = { ...newGrid[item.index], char: targetCell.char };
                newGrid[target.index] = { ...targetCell, char: sourceChar };
                setGrid(newGrid);
                checkFullAndVerifyReal(newGrid);
            }
            else if (item.source === 'grid' && target.type === 'inventory' && item.index !== undefined) {
                const newGrid = [...grid];
                const char = newGrid[item.index].char;
                if (!char) return;
                newGrid[item.index] = { ...newGrid[item.index], char: null };
                setGrid(newGrid);
                setInventory([...inventory, { id: Date.now(), char }]);
            }
        }
        else if (view === 'daily') {
            if (item.source === 'pool' && target.type === 'builder') {
                const newPool = [...dailyPool];
                const poolIdx = newPool.findIndex(t => t.char === item.char);
                const [movedTile] = newPool.splice(poolIdx, 1);

                const newCurrent = [...dailyCurrent];
                if (target.index !== undefined) {
                    newCurrent.splice(target.index, 0, movedTile);
                } else {
                    newCurrent.push(movedTile);
                }
                setDailyPool(newPool);
                setDailyCurrent(newCurrent);
            }
            else if (item.source === 'builder' && target.type === 'builder' && item.index !== undefined) {
                if (item.index === target.index) return;
                const newCurrent = [...dailyCurrent];
                const [movedTile] = newCurrent.splice(item.index, 1);

                let insertIdx = target.index !== undefined ? target.index : newCurrent.length;
                if (target.index !== undefined && item.index < target.index) {
                    insertIdx--;
                }

                newCurrent.splice(insertIdx, 0, movedTile);
                setDailyCurrent(newCurrent);
            }
            else if (item.source === 'builder' && target.type === 'pool' && item.index !== undefined) {
                const newCurrent = [...dailyCurrent];
                const [movedTile] = newCurrent.splice(item.index, 1);
                setDailyCurrent(newCurrent);
                setDailyPool([...dailyPool, movedTile]);
            }
        }
    }, [view, grid, inventory, dailyPool, dailyCurrent, checkFullAndVerifyReal]);

    const onQuickClick = useCallback((item: DragItem) => {
        if (view === 'main') {
            if (item.source === 'inventory') {
                const firstEmpty = grid.findIndex(c => c.type !== 'block' && c.char === null);
                if (firstEmpty !== -1) onDrop(item, { type: 'grid', index: firstEmpty });
            } else if (item.source === 'grid') {
                onDrop(item, { type: 'inventory' });
            }
        } else if (view === 'daily') {
            if (item.source === 'pool') {
                onDrop(item, { type: 'builder', index: dailyCurrent.length });
            } else if (item.source === 'builder') {
                onDrop(item, { type: 'pool' });
            }
        }
    }, [view, grid, dailyCurrent.length, onDrop]);

    const { dragInfo, hoverTarget, startDrag } = useDragAndDrop(onDrop, onQuickClick);

    // --- STATE RECOVERY ---
    const loadLevel = useCallback((index: number) => {
        const level = index < LEVELS.length ? LEVELS[index] : getProceduralLevel(index);
        const saved = localStorage.getItem('mathScrabble_current_play');
        
        if (saved) {
            try {
                const savedState = JSON.parse(saved);
                if (savedState.levelIndex === index) {
                    setGrid(savedState.grid);
                    setInventory(savedState.inventory);
                    setIsLevelCleared(savedState.isLevelCleared || false);
                    setIsNewClear(savedState.isNewClear || false);
                    setCurrentLevelData(level);
                    return;
                }
            } catch (e) {
                console.error("Failed to restore saved level", e);
            }
        }

        const initialGrid: GridCell[] = level.layout.map((typeCode) => ({
            type: typeCode === 1 ? 'block' : 'empty',
            char: null
        }));
        setGrid(initialGrid);
        setInventory(level.inventory.map((char, i) => ({ id: i, char })));
        setCurrentLevelData(level);
        setIsLevelCleared(false);
        setIsNewClear(false);
    }, []);

    const loadDaily = useCallback(() => {
        const date = new Date().toISOString().split('T')[0];
        const saved = localStorage.getItem(`mathScrabble_save_daily_${date}`);

        if (saved) {
            try {
                const { 
                    dailyPool: savedPool, 
                    dailyCurrent: savedCurrent, 
                    dailySubmitted: savedSubmitted,
                    dailyKnownRelations: savedKnown
                } = JSON.parse(saved);
                setDailyPool(savedPool);
                setDailyCurrent(savedCurrent);
                setDailySubmitted(savedSubmitted);
                setDailyKnownRelations(new Set(savedKnown || []));
                return;
            } catch (e) {
                console.error("Failed to restore daily save", e);
            }
        }

        setDailyPool(DAILY_POOL.map((char, i) => ({ id: `d-${i}`, char })));
        setDailyCurrent([]);
        setDailySubmitted([]);
        setDailyKnownRelations(new Set());
    }, []);

    useEffect(() => {
        if (view === 'main') loadLevel(levelIndex);
        if (view === 'daily') loadDaily();
    }, [view, levelIndex, loadLevel, loadDaily]);

    // --- AUTO-SAVE ---
    useEffect(() => {
        if (view !== 'main' || !currentLevelData) return;
        
        // Safety: only save if the current grid data matches the level index
        if (currentLevelData.id !== levelIndex + 1) return;

        const isGridEmpty = grid.every(cell => !cell.char);
        if (!isGridEmpty) {
            const state = { levelIndex, grid, inventory, isLevelCleared, isNewClear };
            localStorage.setItem('mathScrabble_current_play', JSON.stringify(state));
        } else {
            // Only remove the save if it belongs to the CURRENT level
            const saved = localStorage.getItem('mathScrabble_current_play');
            if (saved) {
                try {
                    const savedState = JSON.parse(saved);
                    if (savedState.levelIndex === levelIndex) {
                        localStorage.removeItem('mathScrabble_current_play');
                    }
                } catch (e) {}
            }
        }
    }, [grid, inventory, isLevelCleared, isNewClear, levelIndex, view, currentLevelData]);

    useEffect(() => {
        if (view !== 'daily') return;
        const date = new Date().toISOString().split('T')[0];
        const state = { 
            dailyPool, 
            dailyCurrent, 
            dailySubmitted, 
            dailyKnownRelations: Array.from(dailyKnownRelations) 
        };
        localStorage.setItem(`mathScrabble_save_daily_${date}`, JSON.stringify(state));
    }, [dailyPool, dailyCurrent, dailySubmitted, dailyKnownRelations, view]);

    // --- DAILY ACTIONS ---
    const submitDailyStatement = () => {
        if (dailyCurrent.length === 0) return;
        const statement = dailyCurrent.map(t => t.char).join('');
        const result = isValidEquation(statement);

        if (!result.valid) {
            showToast(result.reason || "Invalid equation", "error");
            return;
        }

        const currentRelations = getNormalizedRelations(statement);
        const isNew = currentRelations.some(rel => !dailyKnownRelations.has(rel));

        if (!isNew) {
            showToast("Mathematically redundant statement.", "error");
            return;
        }

        const newKnown = new Set(dailyKnownRelations);
        currentRelations.forEach(rel => newKnown.add(rel));
        
        setDailyKnownRelations(newKnown);
        setDailySubmitted([statement, ...dailySubmitted]);
        setDailyPool([...dailyPool, ...dailyCurrent]);
        setDailyCurrent([]);
        showToast("New discovery!", "success");
    };

    const resetLevel = () => {
        resetDialogRef.current?.showModal();
    };

    const handleResetConfirm = () => {
        localStorage.removeItem('mathScrabble_current_play');
        loadLevel(levelIndex);
        resetDialogRef.current?.close();
    };

    // --- RENDERERS ---
    const renderMenu = () => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <div className="text-center max-w-2xl">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-6">
                    Equate.
                </h1>
                <p className="text-xl text-slate-300 mb-12">The mathematical Scrabble challenge.</p>

                <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
                    <button onClick={() => setView('main')} className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-xl font-bold transition-all shadow-lg hover:shadow-blue-500/50">
                        <Play size={24} /> Main Puzzles
                    </button>
                    <button onClick={() => setView('daily')} className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/50">
                        <Calendar size={24} /> Daily Free Play
                    </button>
                </div>

                <div className="mt-12 p-6 bg-slate-800 rounded-xl text-left shadow-inner">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><AlertCircle className="text-blue-400" /> Core Rules</h3>
                    <ul className="list-disc pl-5 text-slate-300 space-y-2">
                        <li>Form multi-digit numbers and chain comparators (<span className="text-blue-400 font-bold">=, &lt;, &gt;, &lt;&gt;</span>).</li>
                        <li>Make <span className="text-blue-400 font-bold">&lt;&gt;</span> (not equal) by placing <span className="text-blue-400 font-bold">&lt;</span> and <span className="text-blue-400 font-bold">&gt;</span> adjacent to each other.</li>
                        <li><span className="text-red-400 font-bold">STRICT RULE:</span> At least one side of any comparison must contain a mathematical operation (<span className="text-orange-400 font-bold">+, −, ×, ÷</span>).</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    const renderMainPuzzle = () => {
        if (!currentLevelData) return null;
        const groupedInventory = getGroupedTilesUtil(inventory);
        const isGridEmpty = grid.every(cell => !cell.char);

        return (
            <div className="h-screen bg-slate-900 text-white flex flex-col items-center pt-8 px-4 overflow-hidden">
                <div className="w-full max-w-4xl flex justify-between items-start mb-8">
                    <button onClick={() => setView('menu')} className="p-2 hover:bg-slate-800 rounded-full transition-colors mt-1">
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
                            
                            <h2 className="text-4xl font-black tracking-tight">Level {currentLevelData.id}</h2>
                            
                            <button 
                                onClick={() => setLevelIndex(levelIndex + 1)} 
                                disabled={!isLevelCleared && levelIndex >= maxProgress}
                                className={`p-1 rounded-lg transition-all ${isNewClear ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30' : (isLevelCleared || levelIndex < maxProgress) ? 'hover:bg-slate-800' : 'disabled:opacity-10'}`}
                                title="Next Level"
                            >
                                <ChevronRight size={40} />
                            </button>
                        </div>
                        {currentLevelData.name && (
                            <p className="text-blue-400 mt-2 font-bold tracking-widest uppercase text-xs opacity-80">
                                {currentLevelData.name}
                            </p>
                        )}
                    </div>

                    <button 
                        onClick={resetLevel} 
                        disabled={isGridEmpty}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors mt-1 disabled:opacity-10" 
                        title="Reset Level"
                    >
                        <RotateCcw size={28} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-full overflow-hidden pb-8">
                    <p className="text-slate-400 mb-8 max-w-lg text-center flex-shrink-0">{currentLevelData.description}</p>
                    <Grid grid={grid} cols={currentLevelData.cols} hoverTarget={hoverTarget} dragInfo={dragInfo} onStartDrag={startDrag} />
                </div>

                <Inventory groupedInventory={groupedInventory} hoverTarget={hoverTarget} onStartDrag={startDrag} />
            </div>
        );
    };

    return (
        <div className="font-sans antialiased overflow-x-hidden selection:bg-blue-500/30">
            <Toast message={toast.message} type={toast.type} />

            {/* GHOST ELEMENT FOR DRAGGING */}
            {dragInfo.isDragging && dragInfo.item && (
                <div
                    id="drag-ghost"
                    className="fixed pointer-events-none z-[100]"
                    style={{
                        left: `${dragInfo.x - dragInfo.offsetX}px`,
                        top: `${dragInfo.y - dragInfo.offsetY}px`,
                    }}
                >
                    <Tile char={dragInfo.item.char} />
                </div>
            )}

            {view === 'menu' && renderMenu()}
            {view === 'main' && renderMainPuzzle()}
            {view === 'daily' && (
                <DailyChallenge 
                    dailyPool={dailyPool}
                    dailyCurrent={dailyCurrent}
                    dailySubmitted={dailySubmitted}
                    timeLeft={timeLeft}
                    hoverTarget={hoverTarget}
                    dragInfo={dragInfo}
                    onBack={() => setView('menu')}
                    onStartDrag={startDrag}
                    onClear={() => { setDailyPool([...dailyPool, ...dailyCurrent]); setDailyCurrent([]); }}
                    onSubmit={submitDailyStatement}
                    getGroupedTiles={getGroupedTilesUtil}
                />
            )}

            <ResetDialog dialogRef={resetDialogRef} onConfirm={handleResetConfirm} />
        </div>
    );
}