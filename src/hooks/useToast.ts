import { useState, useCallback } from 'react';

export interface ToastState {
    message: string;
    type: string;
}

export const useToast = () => {
    const [toast, setToast] = useState<ToastState>({ message: '', type: '' });

    const showToast = useCallback((message: string, type: string = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: '' }), 3000);
    }, []);

    return { toast, showToast };
};
