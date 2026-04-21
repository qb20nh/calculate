import React, { useState, useEffect, useRef } from 'react';
import { Play, Calendar, ArrowLeft, Check, RotateCcw, AlertCircle, Trophy } from 'lucide-react';

// --- GAME DATA & LEVELS ---
const LEVELS = [
    {
        id: 1,
        name: "The Basics",
        rows: 1, cols: 5,
        layout: [0, 0, 0, 0, 0],
        inventory: ['4', '+', '4', '=', '8', '2', '>'],
        description: "Form a true statement. Remember: at least one side needs a math operator!"
    },
    {
        id: 2,
        name: "Chain Reaction",
        rows: 1, cols: 7,
        layout: [0, 0, 0, 0, 0, 0, 0],
        inventory: ['1', '+', '2', '=', '3', '<', '9', '5', '−'],
        description: "You can chain comparators together!"
    },
    {
        id: 3,
        name: "The Crossword",
        rows: 5, cols: 5,
        layout: [
            0, 0, 0, 0, 0,
            0, 1, 1, 1, 0,
            0, 0, 0, 0, 0,
            0, 1, 1, 1, 0,
            0, 0, 0, 0, 0
        ],
        inventory: ['3', '+', '2', '=', '5', '×', '−', '2', '×', '2', '=', '4', '=', '=', '6', '−', '5', '=', '1', '9', '+', '<', '>'],
        description: "Statements must be mathematically true reading left-to-right AND top-to-bottom."
    }
];

const DAILY_POOL = ['1', '2', '2', '3', '4', '5', '8', '+', '+', '−', '×', '=', '=', '<', '>'];
const SORT_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '−', '×', '÷', '=', '<', '>'];

// --- PROCEDURAL GENERATOR ---
let currentSeed = 12345;
const setSeed = (seed) => { currentSeed = seed; };
const seededRandom = () => {
    let t = currentSeed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const getRandomInt = (min, max) => Math.floor(seededRandom() * (max - min + 1)) + min;

const generateEquationString = (levelId) => {
    const maxVal = Math.min(100, 5 + Math.floor(levelId / 2));
    const useAdvanced = levelId > 5 && seededRandom() > 0.5;

    const ops = ['+', '−', '×'];
    if (levelId > 10) ops.push('÷');

    const op = ops[getRandomInt(0, ops.length - 1)];
    let a, b, c;
    if (op === '+') {
        a = getRandomInt(1, maxVal); b = getRandomInt(1, maxVal); c = a + b;
    } else if (op === '−') {
        c = getRandomInt(1, maxVal); b = getRandomInt(1, maxVal); a = c + b;
    } else if (op === '×') {
        a = getRandomInt(1, Math.min(maxVal, 15)); b = getRandomInt(1, Math.min(maxVal, 15)); c = a * b;
    } else if (op === '÷') {
        c = getRandomInt(1, Math.min(maxVal, 10)); b = getRandomInt(1, Math.min(maxVal, 10)); a = c * b;
    }

    let eq = `${a}${op}${b}=${c}`;

    if (useAdvanced) {
        const comp = ['<', '>', '<>'][getRandomInt(0, 2)];
        const lastVal = c;
        if (comp === '<') eq += `<${lastVal + getRandomInt(1, maxVal)}`;
        if (comp === '>') eq += `>${lastVal - getRandomInt(1, Math.max(1, lastVal - 1))}`;
        if (comp === '<>') eq += `<>${lastVal + getRandomInt(1, maxVal)}`;
    }
    return eq;
};

const getProceduralLevel = (levelIndex) => {
    const levelId = levelIndex + 1;
    setSeed(levelId * 12345); // Deterministic seed based on level number

    let maxWords = 1;
    if (levelId > 3) maxWords = 2;
    if (levelId > 10) maxWords = 3;
    if (levelId > 25) maxWords = 4;
    if (levelId > 50) maxWords = 5;
    if (levelId > 100) maxWords = Math.min(8, 5 + Math.floor((levelId - 100) / 50));

    let board = new Map();
    let placedWords = [];

    const canPlace = (word, startX, startY, isHoriz, currentBoard) => {
        for (let i = 0; i < word.length; i++) {
            const x = isHoriz ? startX + i : startX;
            const y = isHoriz ? startY : startY + i;
            const key = `${x},${y}`;
            // Ensure we only overlap matching characters
            if (currentBoard.has(key) && currentBoard.get(key) !== word[i]) return false;

            // Ensure we don't accidentally create parallel adjacent words
            if (isHoriz) {
                if (!currentBoard.has(key)) {
                    if (currentBoard.has(`${x},${y - 1}`) || currentBoard.has(`${x},${y + 1}`)) return false;
                }
                if (i === 0 && currentBoard.has(`${x - 1},${y}`)) return false;
                if (i === word.length - 1 && currentBoard.has(`${x + 1},${y}`)) return false;
            } else {
                if (!currentBoard.has(key)) {
                    if (currentBoard.has(`${x - 1},${y}`) || currentBoard.has(`${x + 1},${y}`)) return false;
                }
                if (i === 0 && currentBoard.has(`${x},${y - 1}`)) return false;
                if (i === word.length - 1 && currentBoard.has(`${x},${y + 1}`)) return false;
            }
        }
        return true;
    };

    let firstWord = generateEquationString(levelId);
    for (let i = 0; i < firstWord.length; i++) board.set(`${i},0`, firstWord[i]);
    placedWords.push({ word: firstWord, x: 0, y: 0, isHoriz: true });

    let attempts = 0;
    while (placedWords.length < maxWords && attempts < 150) {
        attempts++;
        const targetWord = placedWords[getRandomInt(0, placedWords.length - 1)];
        const charIdx = getRandomInt(0, targetWord.word.length - 1);
        const targetChar = targetWord.word[charIdx];
        const intersectX = targetWord.isHoriz ? targetWord.x + charIdx : targetWord.x;
        const intersectY = targetWord.isHoriz ? targetWord.y : targetWord.y + charIdx;

        let newWord = "";
        for (let genAttempts = 0; genAttempts < 30; genAttempts++) {
            let cand = generateEquationString(levelId);
            if (cand.includes(targetChar)) { newWord = cand; break; }
        }
        if (!newWord) continue;

        let indices = [];
        for (let i = 0; i < newWord.length; i++) if (newWord[i] === targetChar) indices.push(i);
        const newCharIdx = indices[getRandomInt(0, indices.length - 1)];

        const isHoriz = !targetWord.isHoriz;
        const startX = isHoriz ? intersectX - newCharIdx : intersectX;
        const startY = isHoriz ? intersectY : intersectY - newCharIdx;

        if (canPlace(newWord, startX, startY, isHoriz, board)) {
            for (let i = 0; i < newWord.length; i++) {
                const x = isHoriz ? startX + i : startX;
                const y = isHoriz ? startY : startY + i;
                board.set(`${x},${y}`, newWord[i]);
            }
            placedWords.push({ word: newWord, x: startX, y: startY, isHoriz });
        }
    }

    // Extract Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let key of board.keys()) {
        const [x, y] = key.split(',').map(Number);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const layout = Array(rows * cols).fill(1); // 1 = block
    const inventoryChars = [];

    for (let [key, char] of board.entries()) {
        const [x, y] = key.split(',').map(Number);
        layout[(y - minY) * cols + (x - minX)] = 0; // 0 = empty playable space
        inventoryChars.push(char);
    }

    // Add random noise tiles to increase difficulty
    const numNoise = Math.floor(levelId / 5);
    const noisePool = ['+', '−', '×', '=', '<', '>', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = 0; i < numNoise; i++) {
        inventoryChars.push(noisePool[getRandomInt(0, noisePool.length - 1)]);
    }

    // Shuffle inventory array
    for (let i = inventoryChars.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [inventoryChars[i], inventoryChars[j]] = [inventoryChars[j], inventoryChars[i]];
    }

    return {
        id: levelId,
        name: `Procedural Stage ${levelId}`,
        rows, cols,
        layout,
        inventory: inventoryChars,
        description: levelId <= 5 ? "Procedural stages begin. Find the hidden intersections!" : "Watch out for extra decoy tiles!"
    };
};

// --- MATH LOGIC ENGINE ---
const isValidEquation = (str) => {
    if (str.length < 3) return { valid: false, reason: "Too short." };
    if (!/^[0-9+−×÷=<>]+$/.test(str)) return { valid: false, reason: "Invalid characters." };

    let comparators = [];
    let expressions = [];
    let currentExpr = "";

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '<' && str[i + 1] === '>') {
            expressions.push(currentExpr);
            comparators.push('<>');
            currentExpr = "";
            i++;
        } else if (['=', '<', '>'].includes(str[i])) {
            expressions.push(currentExpr);
            comparators.push(str[i]);
            currentExpr = "";
        } else {
            currentExpr += str[i];
        }
    }
    expressions.push(currentExpr);

    if (comparators.length === 0) return { valid: false, reason: "Must contain a comparator (=, <, >, <>)." };
    if (expressions.some(e => e === "")) return { valid: false, reason: "Misplaced comparators." };

    for (let i = 0; i < comparators.length; i++) {
        let leftExpr = expressions[i];
        let rightExpr = expressions[i + 1];
        let leftHasOp = /[0-9][+−×÷]/.test(leftExpr);
        let rightHasOp = /[0-9][+−×÷]/.test(rightExpr);

        if (!leftHasOp && !rightHasOp) {
            return { valid: false, reason: `Invalid comparison: neither side of '${comparators[i]}' contains an operator.` };
        }
    }

    let values = [];
    for (let expr of expressions) {
        try {
            if (/\b0[0-9]+/.test(expr)) return { valid: false, reason: "Leading zeros not allowed." };
            let val = Function(`'use strict'; return (${expr.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/')})`)();
            if (!Number.isFinite(val)) return { valid: false, reason: "Invalid mathematical result (e.g., division by zero)." };
            values.push(val);
        } catch (e) {
            return { valid: false, reason: `Invalid syntax in expression: ${expr}` };
        }
    }

    for (let i = 0; i < comparators.length; i++) {
        let left = values[i];
        let right = values[i + 1];
        let comp = comparators[i];
        if (comp === '=' && !(left === right)) return { valid: false, reason: `Mathematically false: ${left} = ${right}` };
        if (comp === '<' && !(left < right)) return { valid: false, reason: `Mathematically false: ${left} < ${right}` };
        if (comp === '>' && !(left > right)) return { valid: false, reason: `Mathematically false: ${left} > ${right}` };
        if (comp === '<>' && !(left !== right)) return { valid: false, reason: `Mathematically false: ${left} <> ${right}` };
    }

    return { valid: true };
};

const checkGridValidity = (grid, cols) => {
    let rows = grid.length / cols;
    let words = [];

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

    if (words.length === 0) return { valid: false, reason: "No equations formed." };

    for (let word of words) {
        let res = isValidEquation(word);
        if (!res.valid) return { valid: false, reason: res.reason };
    }

    const isFull = grid.every(cell => cell.type === 'block' || cell.char !== null);
    if (!isFull) return { valid: false, reason: "Fill all empty spaces.", isFull: false };

    return { valid: true };
};

const getGroupedTiles = (tilesArray) => {
    const counts = {};
    tilesArray.forEach(t => counts[t.char] = (counts[t.char] || 0) + 1);
    return Object.keys(counts)
        .sort((a, b) => {
            let idxA = SORT_ORDER.indexOf(a);
            let idxB = SORT_ORDER.indexOf(b);
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        })
        .map(char => ({ char, count: counts[char] }));
};

// --- UI COMPONENTS ---
const Tile = ({ char, count, isFaded, onPointerDown }) => {
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

const Toast = ({ message, type }) => {
    if (!message) return null;
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[150] whitespace-nowrap
      ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            {message}
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
    const [view, setView] = useState('menu');
    const [toast, setToast] = useState({ message: '', type: '' });

    const showToast = (message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: '' }), 3000);
    };

    const [levelIndex, setLevelIndex] = useState(() => {
        const saved = localStorage.getItem('mathScrabbleProgress');
        return saved !== null ? parseInt(saved, 10) : 0;
    });
    const [currentLevelData, setCurrentLevelData] = useState(null);
    const [grid, setGrid] = useState([]);
    const [inventory, setInventory] = useState([]);

    const [dailyPool, setDailyPool] = useState([]);
    const [dailyCurrent, setDailyCurrent] = useState([]);
    const [dailySubmitted, setDailySubmitted] = useState([]);

    // --- DRAG AND DROP STATE ---
    const [dragInfo, setDragInfo] = useState({
        isDragging: false,
        item: null,
        startX: 0, startY: 0,
        startTime: 0,
        x: 0, y: 0,
        offsetX: 0, offsetY: 0,
    });
    const [hoverTarget, setHoverTarget] = useState(null); // { type, index }

    useEffect(() => {
        if (view === 'main') loadLevel(levelIndex);
        if (view === 'daily') loadDaily();
    }, [view, levelIndex]);

    const loadLevel = (index) => {
        const level = index < LEVELS.length ? LEVELS[index] : getProceduralLevel(index);
        const initialGrid = level.layout.map((typeCode) => ({
            type: typeCode === 1 ? 'block' : 'empty',
            char: null
        }));
        setGrid(initialGrid);
        setInventory(level.inventory.map((char, i) => ({ id: i, char })));
        setCurrentLevelData(level);
    };

    const loadDaily = () => {
        setDailyPool(DAILY_POOL.map((char, i) => ({ id: i, char })));
        setDailyCurrent([]);
    };

    // --- DRAG ENGINE ---
    const startDrag = (e, item) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDragInfo({
            isDragging: true,
            item,
            startX: e.clientX, startY: e.clientY,
            startTime: Date.now(),
            x: e.clientX, y: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
        });
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!dragInfo.isDragging) return;
            setDragInfo(prev => ({ ...prev, x: e.clientX, y: e.clientY }));

            // Temporarily hide ghost to find element underneath
            const ghost = document.getElementById('drag-ghost');
            if (ghost) ghost.style.display = 'none';
            const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
            if (ghost) ghost.style.display = 'flex';

            if (!elemUnder) {
                setHoverTarget(null);
                return;
            }

            const dropZone = elemUnder.closest('[data-dropzone]');
            if (dropZone) {
                const type = dropZone.getAttribute('data-dropzone');
                const indexStr = dropZone.getAttribute('data-index');
                const index = indexStr !== null ? parseInt(indexStr, 10) : null;
                setHoverTarget({ type, index });
            } else {
                setHoverTarget(null);
            }
        };

        const handlePointerUp = (e) => {
            if (!dragInfo.isDragging) return;

            const dist = Math.hypot(e.clientX - dragInfo.startX, e.clientY - dragInfo.startY);
            const time = Date.now() - dragInfo.startTime;

            // Treat as quick click if barely moved
            if (dist < 10 && time < 300) {
                handleQuickClick(dragInfo.item);
            } else {
                handleDrop(dragInfo.item, hoverTarget);
            }

            setDragInfo({ isDragging: false, item: null, startX: 0, startY: 0, startTime: 0, x: 0, y: 0, offsetX: 0, offsetY: 0 });
            setHoverTarget(null);
        };

        if (dragInfo.isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerUp);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [dragInfo.isDragging, dragInfo.startX, dragInfo.startY, dragInfo.startTime, dragInfo.item, hoverTarget, grid, inventory, dailyPool, dailyCurrent]);

    // --- DROP HANDLER ---
    const handleDrop = (item, target) => {
        if (!target) return;

        // View: Main Puzzle
        if (view === 'main') {
            if (item.source === 'inventory' && target.type === 'grid') {
                const cell = grid[target.index];
                if (cell.type === 'block') return;

                const newInventory = [...inventory];
                const invIdx = newInventory.findIndex(t => t.char === item.char);
                const [movedTile] = newInventory.splice(invIdx, 1);

                const newGrid = [...grid];
                if (cell.char !== null) {
                    newInventory.push({ id: Date.now(), char: cell.char }); // return existing
                }
                newGrid[target.index] = { ...cell, char: movedTile.char };
                setGrid(newGrid);
                setInventory(newInventory);
                checkFullAndVerify(newGrid);
            }
            else if (item.source === 'grid' && target.type === 'grid') {
                const targetCell = grid[target.index];
                if (targetCell.type === 'block') return;

                const newGrid = [...grid];
                const sourceChar = newGrid[item.index].char;
                newGrid[item.index] = { ...newGrid[item.index], char: targetCell.char }; // Swap
                newGrid[target.index] = { ...targetCell, char: sourceChar };
                setGrid(newGrid);
                checkFullAndVerify(newGrid);
            }
            else if (item.source === 'grid' && target.type === 'inventory') {
                const newGrid = [...grid];
                const char = newGrid[item.index].char;
                newGrid[item.index] = { ...newGrid[item.index], char: null };
                setGrid(newGrid);
                setInventory([...inventory, { id: Date.now(), char }]);
            }
        }
        // View: Daily Mode
        else if (view === 'daily') {
            if (item.source === 'pool' && target.type === 'builder') {
                const newPool = [...dailyPool];
                const poolIdx = newPool.findIndex(t => t.char === item.char);
                const [movedTile] = newPool.splice(poolIdx, 1);

                const newCurrent = [...dailyCurrent];
                if (target.index !== null && target.index !== undefined) {
                    newCurrent.splice(target.index, 0, movedTile);
                } else {
                    newCurrent.push(movedTile);
                }
                setDailyPool(newPool);
                setDailyCurrent(newCurrent);
            }
            else if (item.source === 'builder' && target.type === 'builder') {
                if (item.index === target.index) return;
                const newCurrent = [...dailyCurrent];
                const [movedTile] = newCurrent.splice(item.index, 1);

                let insertIdx = target.index !== null ? target.index : newCurrent.length;
                if (target.index !== null && item.index < target.index) {
                    insertIdx--; // Adjust for the removed item shifting the array
                }

                newCurrent.splice(insertIdx, 0, movedTile);
                setDailyCurrent(newCurrent);
            }
            else if (item.source === 'builder' && target.type === 'pool') {
                const newCurrent = [...dailyCurrent];
                const [movedTile] = newCurrent.splice(item.index, 1);
                setDailyCurrent(newCurrent);
                setDailyPool([...dailyPool, movedTile]);
            }
        }
    };

    // --- CLICK FALLBACK HANDLERS ---
    const handleQuickClick = (item) => {
        if (view === 'main') {
            if (item.source === 'inventory') {
                // Place in first empty spot
                const firstEmpty = grid.findIndex(c => c.type !== 'block' && c.char === null);
                if (firstEmpty !== -1) handleDrop(item, { type: 'grid', index: firstEmpty });
            } else if (item.source === 'grid') {
                handleDrop(item, { type: 'inventory' });
            }
        } else if (view === 'daily') {
            if (item.source === 'pool') {
                handleDrop(item, { type: 'builder', index: dailyCurrent.length });
            } else if (item.source === 'builder') {
                handleDrop(item, { type: 'pool' });
            }
        }
    };

    const checkFullAndVerify = (currentGrid) => {
        const isFull = currentGrid.every(c => c.type === 'block' || c.char !== null);
        if (isFull) {
            const level = currentLevelData;
            const result = checkGridValidity(currentGrid, level.cols);
            if (result.valid) {
                showToast("Brilliant! Stage Clear.", "success");
                setTimeout(() => {
                    if (levelIndex + 1 < 1000) {
                        const nextLevel = levelIndex + 1;
                        setLevelIndex(nextLevel);
                        localStorage.setItem('mathScrabbleProgress', nextLevel.toString());
                    } else {
                        showToast("Campaign Completed! You are a Math God.", "success");
                        setView('menu');
                    }
                }, 2000);
            } else {
                showToast(result.reason, "error");
            }
        }
    };

    const resetLevel = () => loadLevel(levelIndex);

    const submitDailyStatement = () => {
        if (dailyCurrent.length === 0) return;
        const statement = dailyCurrent.map(t => t.char).join('');
        const result = isValidEquation(statement);

        if (!result.valid) {
            showToast(result.reason, "error");
            return;
        }
        if (dailySubmitted.includes(statement)) {
            showToast("You already found this statement!", "error");
            return;
        }

        setDailySubmitted([statement, ...dailySubmitted]);
        showToast("Valid statement found!", "success");
        setDailyPool([...dailyPool, ...dailyCurrent]);
        setDailyCurrent([]);
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
        const level = currentLevelData;
        if (!level) return null;
        const groupedInventory = getGroupedTiles(inventory);

        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center pt-8 px-4">
                <div className="w-full max-w-4xl flex justify-between items-center mb-8">
                    <button onClick={() => setView('menu')} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft size={28} />
                    </button>
                    <h2 className="text-2xl font-bold">Level {level.id}: {level.name}</h2>
                    <button onClick={resetLevel} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Reset Level">
                        <RotateCcw size={28} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-full overflow-hidden pb-8">
                    <p className="text-slate-400 mb-8 max-w-lg text-center flex-shrink-0">{level.description}</p>

                    {/* The Grid container wrapper for scrolling large levels */}
                    <div className="w-full max-w-full overflow-auto flex justify-center items-center px-4">
                        <div
                            className="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl relative flex-shrink-0"
                            style={{ display: 'grid', gridTemplateColumns: `repeat(${level.cols}, 1fr)`, gap: '8px' }}
                        >
                            {grid.map((cell, idx) => {
                                const isHovered = hoverTarget?.type === 'grid' && hoverTarget.index === idx;
                                const isBeingDragged = dragInfo.item?.source === 'grid' && dragInfo.item?.index === idx;

                                return (
                                    <div
                                        key={idx}
                                        data-dropzone={cell.type === 'empty' ? "grid" : null}
                                        data-index={idx}
                                        className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-all 
                    ${cell.type === 'block' ? 'bg-slate-900/50 shadow-inner' : 'bg-slate-700 shadow-inner'}
                    ${isHovered && cell.type !== 'block' ? 'ring-4 ring-blue-400 scale-105 bg-slate-600 z-10' : ''}
                  `}
                                    >
                                        {cell.char && !isBeingDragged && (
                                            <Tile char={cell.char} onPointerDown={(e) => startDrag(e, { source: 'grid', index: idx, char: cell.char })} />
                                        )}
                                        {isBeingDragged && (
                                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg border-2 border-dashed border-slate-500 bg-slate-600/50" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Inventory Container */}
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
                                onPointerDown={(e) => startDrag(e, { source: 'inventory', char: grp.char })}
                            />
                        ))}
                        {groupedInventory.length === 0 && <span className="text-slate-500 italic mt-2">All tiles placed.</span>}
                    </div>
                </div>
            </div>
        );
    };

    const renderDaily = () => {
        const groupedDailyPool = getGroupedTiles(dailyPool);

        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center pt-8 px-4">
                <div className="w-full max-w-4xl flex justify-between items-center mb-8">
                    <button onClick={() => setView('menu')} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft size={28} />
                    </button>
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="text-emerald-400" /> Daily Challenge</h2>
                    <div className="w-10"></div>
                </div>

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
                                        onPointerDown={(e) => startDrag(e, { source: 'builder', index: idx, char: tile.char })}
                                    />
                                </div>
                            );
                        })}
                        {dailyCurrent.length === 0 && <span className="text-slate-600 italic ml-2 pointer-events-none">Drag tiles here...</span>}
                    </div>

                    <div className="flex justify-between items-center">
                        <button onClick={() => { setDailyPool([...dailyPool, ...dailyCurrent]); setDailyCurrent([]); }} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                            <RotateCcw size={16} /> Clear
                        </button>
                        <button
                            onClick={submitDailyStatement}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            disabled={dailyCurrent.length === 0}
                        >
                            Submit Statement
                        </button>
                    </div>
                </div>

                {/* Pool Area */}
                <div data-dropzone="pool" className={`w-full max-w-2xl mb-12 p-4 rounded-xl border border-transparent transition-colors ${hoverTarget?.type === 'pool' ? 'bg-slate-800/50 border-slate-600' : ''}`}>
                    <div className="text-sm text-slate-400 mb-2">Today's Pool:</div>
                    <div className="flex flex-wrap gap-4 pt-2">
                        {groupedDailyPool.map((grp) => (
                            <Tile
                                key={grp.char}
                                char={grp.char}
                                count={grp.count}
                                onPointerDown={(e) => startDrag(e, { source: 'pool', char: grp.char })}
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
            {view === 'daily' && renderDaily()}
        </div>
    );
}