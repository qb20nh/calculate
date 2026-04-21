import React, { useState } from 'react';
import { ViewType } from './domain/types';
import { MainMenu } from './features/menu/MainMenu';
import { PuzzleView } from './features/puzzle/PuzzleView';
import { DailyView } from './features/daily/DailyView';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

export default function App() {
    const [view, setView] = useState<ViewType>('menu');
    const { toast, showToast } = useToast();

    return (
        <div className="font-sans antialiased overflow-x-hidden selection:bg-blue-500/30 min-h-screen bg-slate-900">
            <Toast message={toast.message} type={toast.type} />

            {view === 'menu' && <MainMenu onNavigate={setView} />}
            {view === 'main' && <PuzzleView onBack={() => setView('menu')} showToast={showToast} />}
            {view === 'daily' && <DailyView onBack={() => setView('menu')} showToast={showToast} />}
        </div>
    );
}