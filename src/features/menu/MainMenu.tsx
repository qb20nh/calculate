import React from 'react';
import { Play, Calendar, AlertCircle } from 'lucide-react';
import { ViewType } from '../../domain/types';

interface MainMenuProps {
    onNavigate: (view: ViewType) => void;
    onPreload?: (view: ViewType) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, onPreload }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <div className="text-center max-w-2xl">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-6">
                    Equate.
                </h1>
                <p className="text-xl text-slate-300 mb-12">The mathematical Scrabble challenge.</p>

                <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
                    <button
                        onClick={() => onNavigate('main')}
                        onMouseEnter={() => onPreload?.('main')}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-xl font-bold transition-all shadow-lg hover:shadow-blue-500/50"
                    >
                        <Play size={24} /> Main Puzzles
                    </button>
                    <button
                        onClick={() => onNavigate('daily')}
                        onMouseEnter={() => onPreload?.('daily')}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/50"
                    >
                        <Calendar size={24} /> Daily Free Play
                    </button>
                </div>

                <div className="mt-12 p-6 bg-slate-800 rounded-xl text-left shadow-inner">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <AlertCircle className="text-blue-400" /> Core Rules
                    </h3>
                    <ul className="list-disc pl-5 text-slate-300 space-y-2">
                        <li>Form multi-digit numbers and chain comparators (<span className="text-blue-400 font-bold">=, &lt;, &gt;, &lt;&gt;</span>).</li>
                        <li>Make <span className="text-blue-400 font-bold">&lt;&gt;</span> (not equal) by placing <span className="text-blue-400 font-bold">&lt;</span> and <span className="text-blue-400 font-bold">&gt;</span> adjacent to each other.</li>
                        <li>At least one side of any comparison must contain a mathematical operation (<span className="text-orange-400 font-bold">+, −, ×, ÷</span>).</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
