import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ResetDialogProps {
    dialogRef: React.RefObject<HTMLDialogElement>;
    onConfirm: () => void;
}

export const ResetDialog: React.FC<ResetDialogProps> = ({ dialogRef, onConfirm }) => {
    return (
        <dialog 
            ref={dialogRef} 
            className="fixed inset-0 m-auto bg-slate-800 text-white p-8 rounded-3xl border border-slate-700 shadow-2xl backdrop:bg-slate-900/80 backdrop:backdrop-blur-sm open:flex flex-col items-center justify-center"
        >
            <div className="flex flex-col items-center gap-6 max-w-xs">
                <div className="bg-red-500/20 p-4 rounded-full">
                    <RotateCcw size={48} className="text-red-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">Reset Level?</h3>
                    <p className="text-slate-400 text-sm">This will clear the entire board and return all tiles to your inventory.</p>
                </div>
                <div className="flex gap-4 w-full">
                    <button 
                        onClick={() => dialogRef.current?.close()} 
                        className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors shadow-lg shadow-red-900/20 text-sm"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </dialog>
    );
};
