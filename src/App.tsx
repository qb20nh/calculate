import React, { useState, Suspense, lazy } from 'react';
import { ViewType } from './domain/types';
import { MainMenu } from './features/menu/MainMenu';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

const PuzzleView = lazy(() => import('./features/puzzle/PuzzleView').then(m => ({ default: m.PuzzleView })));
const DailyView = lazy(() => import('./features/daily/DailyView').then(m => ({ default: m.DailyView })));

export default function App() {
    const [view, setView] = useState<ViewType>('menu');
    const { toast, showToast } = useToast();

    const handlePreload = (v: ViewType) => {
        if (v === 'main') import('./features/puzzle/PuzzleView');
        if (v === 'daily') import('./features/daily/DailyView');
    };

    return (
        <div className="font-sans antialiased overflow-x-hidden selection:bg-blue-500/30 min-h-screen bg-slate-900">
            <Toast message={toast.message} type={toast.type} />

            <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
                {view === 'menu' && <MainMenu onNavigate={setView} onPreload={handlePreload} />}
                {view === 'main' && <PuzzleView onBack={() => setView('menu')} showToast={showToast} />}
                {view === 'daily' && <DailyView onBack={() => setView('menu')} showToast={showToast} />}
            </Suspense>
        </div>
    );
}