import { useState, useEffect } from 'react';
import { DragInfo, HoverTarget, DragItem } from '../domain/types';

export const useDragAndDrop = (onDrop: (item: DragItem, target: HoverTarget | null) => void, onQuickClick: (item: DragItem) => void) => {
    const [dragInfo, setDragInfo] = useState<DragInfo>({
        isDragging: false,
        item: null,
        startX: 0, startY: 0,
        startTime: 0,
        x: 0, y: 0,
        offsetX: 0, offsetY: 0
    });
    const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

    const startDrag = (e: React.PointerEvent, item: DragItem) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
        const handlePointerMove = (e: PointerEvent) => {
            if (!dragInfo.isDragging) return;
            setDragInfo(prev => ({ ...prev, x: e.clientX, y: e.clientY }));

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
                const type = dropZone.getAttribute('data-dropzone') as HoverTarget['type'];
                const indexStr = dropZone.getAttribute('data-index');
                const index = indexStr !== null ? parseInt(indexStr, 10) : undefined;
                setHoverTarget({ type, index });
            } else {
                setHoverTarget(null);
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!dragInfo.isDragging) return;

            const dist = Math.hypot(e.clientX - dragInfo.startX, e.clientY - dragInfo.startY);
            const time = Date.now() - dragInfo.startTime;

            if (dragInfo.item) {
                if (dist < 10 && time < 300) {
                    onQuickClick(dragInfo.item);
                } else {
                    onDrop(dragInfo.item, hoverTarget);
                }
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
    }, [dragInfo.isDragging, dragInfo.startX, dragInfo.startY, dragInfo.startTime, dragInfo.item, hoverTarget, onDrop, onQuickClick]);

    return { dragInfo, hoverTarget, startDrag };
};
