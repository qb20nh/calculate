import React, { useState, Suspense, lazy } from 'react';
import { ViewType } from './domain/types';
import { MainMenu } from './features/menu/MainMenu';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

import { WarmableView } from './components/WarmableView';

const PuzzleView = lazy(() => import('./features/puzzle/PuzzleView').then(m => ({ default: m.PuzzleView })));
const DailyView = lazy(() => import('./features/daily/DailyView').then(m => ({ default: m.DailyView })));

const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900 z-50">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
);

export default function App() {
    const [view, setView] = useState<ViewType>('menu');
    const [warmedViews, setWarmedViews] = useState<Set<ViewType>>(new Set());
    const { toast, showToast } = useToast();

    const handlePreload = (v: ViewType) => {
        if (v === 'main') import('./features/puzzle/PuzzleView');
        if (v === 'daily') import('./features/daily/DailyView');
        
        setWarmedViews(prev => {
            if (prev.has(v)) return prev;
            const next = new Set(prev);
            next.add(v);
            return next;
        });
    };

    const handleNavigate = (v: ViewType) => {
        handlePreload(v);
        setView(v);
    };

    return (
        <div className="font-sans antialiased overflow-x-hidden selection:bg-blue-500/30 min-h-screen bg-slate-900">
            <Toast message={toast.message} type={toast.type} />

            <div className={view === 'menu' ? 'block' : 'hidden'}>
                <MainMenu onNavigate={handleNavigate} onPreload={handlePreload} />
            </div>

            <WarmableView 
                isActive={view === 'main'} 
                isWarmed={warmedViews.has('main')} 
                fallback={<LoadingSpinner />}
            >
                <PuzzleView onBack={() => setView('menu')} showToast={showToast} />
            </WarmableView>

            <WarmableView 
                isActive={view === 'daily'} 
                isWarmed={warmedViews.has('daily')} 
                fallback={<LoadingSpinner />}
            >
                <DailyView onBack={() => setView('menu')} showToast={showToast} />
            </WarmableView>
        </div>
    );
}