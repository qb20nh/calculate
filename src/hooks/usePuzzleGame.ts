import { useState, useEffect, useCallback } from 'react';
import { Level, GridCell, TileItem, DragItem, HoverTarget } from '../domain/types';
import { StorageService } from '../services/StorageService';
import { LevelService } from '../services/LevelService';
import { validateGrid } from '../domain/grid';

export const usePuzzleGame = (showToast: (msg: string, type?: string) => void) => {
    // Progress State
    // Progress State
    const [levelIndex, setLevelIndex] = useState(() => {
        const saved = StorageService.getCurrentPlay();
        return saved ? saved.levelIndex : 0;
    });
    const [maxProgress, setMaxProgress] = useState(() => StorageService.getMaxProgress());

    // Game State initialization helper
    const getInitialState = (idx: number) => {
        const level = LevelService.getLevel(idx);
        const saved = StorageService.getCurrentPlay();
        
        if (saved && saved.levelIndex === idx) {
            return {
                grid: saved.grid,
                inventory: saved.inventory,
                isLevelCleared: saved.isLevelCleared || false,
                isNewClear: saved.isNewClear || false,
                levelData: level
            };
        }

        return {
            grid: LevelService.createInitialGrid(level),
            inventory: level.inventory.map((char, i) => ({ id: i, char })),
            isLevelCleared: false,
            isNewClear: false,
            levelData: level
        };
    };

    const initial = getInitialState(levelIndex);

    const [currentLevelData, setCurrentLevelData] = useState<Level | null>(initial.levelData);
    const [grid, setGrid] = useState<GridCell[]>(initial.grid);
    const [inventory, setInventory] = useState<TileItem[]>(initial.inventory);
    const [isLevelCleared, setIsLevelCleared] = useState(initial.isLevelCleared);
    const [isNewClear, setIsNewClear] = useState(initial.isNewClear);

    // --- Actions ---
    const loadLevel = useCallback((index: number) => {
        const state = getInitialState(index);
        setGrid(state.grid);
        setInventory(state.inventory);
        setIsLevelCleared(state.isLevelCleared);
        setIsNewClear(state.isNewClear);
        setCurrentLevelData(state.levelData);
    }, []);

    const checkFullAndVerify = useCallback((currentGrid: GridCell[]) => {
        if (!currentLevelData) return;
        const isFull = currentGrid.every(c => c.type === 'block' || c.char !== null);
        if (isFull) {
            const result = validateGrid(currentGrid, currentLevelData.cols);
            if (result.valid) {
                showToast("Brilliant! Stage Clear.", "success");
                setIsLevelCleared(true);
                if (levelIndex >= maxProgress) {
                    setIsNewClear(true);
                }
                const nextSavedLevel = Math.max(levelIndex + 1, maxProgress);
                StorageService.setMaxProgress(nextSavedLevel);
                setMaxProgress(nextSavedLevel);
            } else {
                showToast(result.reason || "Invalid statements.", "error");
            }
        }
    }, [currentLevelData, levelIndex, maxProgress, showToast]);

    const handleDrop = useCallback((item: DragItem, target: HoverTarget | null) => {
        if (!target || target.type !== 'grid' || target.index === undefined) return;
        
        const cell = grid[target.index];
        if (cell.type === 'block') return;

        if (item.source === 'inventory') {
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
            checkFullAndVerify(newGrid);
        }
        else if (item.source === 'grid' && item.index !== undefined) {
            const newGrid = [...grid];
            const sourceChar = newGrid[item.index].char;
            newGrid[item.index] = { ...newGrid[item.index], char: cell.char };
            newGrid[target.index] = { ...cell, char: sourceChar };
            setGrid(newGrid);
            checkFullAndVerify(newGrid);
        }
    }, [grid, inventory, checkFullAndVerify]);

    const handleReturnToInventory = useCallback((item: DragItem) => {
        if (item.source !== 'grid' || item.index === undefined) return;
        const newGrid = [...grid];
        const char = newGrid[item.index].char;
        if (!char) return;
        newGrid[item.index] = { ...newGrid[item.index], char: null };
        setGrid(newGrid);
        setInventory(prev => [...prev, { id: Date.now(), char }]);
    }, [grid]);

    const handleQuickClick = useCallback((item: DragItem) => {
        if (item.source === 'inventory') {
            const firstEmpty = grid.findIndex(c => c.type !== 'block' && c.char === null);
            if (firstEmpty !== -1) handleDrop(item, { type: 'grid', index: firstEmpty });
        } else if (item.source === 'grid') {
            handleReturnToInventory(item);
        }
    }, [grid, handleDrop, handleReturnToInventory]);

    const resetLevel = useCallback(() => {
        StorageService.removeCurrentPlay();
        loadLevel(levelIndex);
    }, [levelIndex, loadLevel]);

    // Lifecycle
    useEffect(() => {
        loadLevel(levelIndex);
    }, [levelIndex, loadLevel]);

    useEffect(() => {
        if (!currentLevelData) return;
        if (currentLevelData.id !== levelIndex + 1) return;

        const isGridEmpty = grid.every(cell => !cell.char);
        if (!isGridEmpty) {
            StorageService.setCurrentPlay({ levelIndex, grid, inventory, isLevelCleared, isNewClear });
        } else {
            const saved = StorageService.getCurrentPlay();
            if (saved && saved.levelIndex === levelIndex) {
                StorageService.removeCurrentPlay();
            }
        }
    }, [grid, inventory, isLevelCleared, isNewClear, levelIndex, currentLevelData]);

    return {
        levelIndex, setLevelIndex,
        maxProgress,
        currentLevelData,
        grid, inventory,
        isLevelCleared, isNewClear, setIsNewClear,
        loadLevel, resetLevel,
        handleDrop, handleReturnToInventory, handleQuickClick
    };
};
