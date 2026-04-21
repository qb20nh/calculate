import { useCallback,useEffect, useState } from 'react';

import { DAILY_POOL } from '../constants/gameData';
import { getNormalizedRelations,isValidEquation } from '../domain/engine';
import { DragItem, HoverTarget,TileItem } from '../domain/types';
import { StorageService } from '../services/StorageService';

export const useDailyChallenge = (showToast: (msg: string, type?: string) => void) => {
    const [date] = useState(() => new Date().toISOString().split('T')[0]);
    
    const getInitialState = useCallback((d: string) => {
        const saved = StorageService.getDailySave(d);
        if (saved) {
            return {
                pool: saved.dailyPool,
                current: saved.dailyCurrent,
                submitted: saved.dailySubmitted,
                knownRelations: new Set<string>(saved.dailyKnownRelations || [])
            };
        }
        return {
            pool: DAILY_POOL.map((char, i) => ({ id: `d-${i}`, char })),
            current: [],
            submitted: [],
            knownRelations: new Set<string>()
        };
    }, []);

    const [dailyPool, setDailyPool] = useState<TileItem[]>(() => getInitialState(date).pool);
    const [dailyCurrent, setDailyCurrent] = useState<TileItem[]>(() => getInitialState(date).current);
    const [dailySubmitted, setDailySubmitted] = useState<string[]>(() => getInitialState(date).submitted);
    const [dailyKnownRelations, setDailyKnownRelations] = useState<Set<string>>(() => getInitialState(date).knownRelations);

    const submitStatement = useCallback(() => {
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
        setDailySubmitted(prev => [statement, ...prev]);
        setDailyPool(prev => [...prev, ...dailyCurrent]);
        setDailyCurrent([]);
        showToast("New discovery!", "success");
    }, [dailyCurrent, dailyKnownRelations, showToast]);

    const handleDrop = useCallback((item: DragItem, target: HoverTarget | null) => {
        if (!target) return;

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
            setDailyPool(prev => [...prev, movedTile]);
        }
    }, [dailyPool, dailyCurrent]);

    const handleQuickClick = useCallback((item: DragItem) => {
        if (item.source === 'pool') {
            handleDrop(item, { type: 'builder', index: dailyCurrent.length });
        } else if (item.source === 'builder') {
            handleDrop(item, { type: 'pool' });
        }
    }, [dailyCurrent.length, handleDrop]);

    const clearBuilder = useCallback(() => {
        setDailyPool(prev => [...prev, ...dailyCurrent]);
        setDailyCurrent([]);
    }, [dailyCurrent]);

    // Lifecycle
    // Persist to storage
    useEffect(() => {
        StorageService.setDailySave(date, { 
            dailyPool, 
            dailyCurrent, 
            dailySubmitted, 
            dailyKnownRelations: Array.from(dailyKnownRelations) 
        });
    }, [dailyPool, dailyCurrent, dailySubmitted, dailyKnownRelations, date]);

    return {
        dailyPool, dailyCurrent, dailySubmitted,
        submitStatement, handleDrop, handleQuickClick, clearBuilder
    };
};
