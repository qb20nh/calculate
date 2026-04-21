import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface ToastProps {
    message: string;
    type: string;
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
    if (!message) return null;
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[150] whitespace-nowrap
      ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            {message}
        </div>
    );
};
