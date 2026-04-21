export interface Level {
    id: number;
    name: string;
    rows: number;
    cols: number;
    layout: number[];
    inventory: string[];
    description: string;
}

export interface TileItem {
    id: string | number;
    char: string;
}

export interface GridCell {
    type: 'empty' | 'block';
    char: string | null;
}

export interface DragItem {
    source: 'grid' | 'inventory' | 'builder' | 'pool';
    index?: number;
    char: string;
}

export interface DragInfo {
    isDragging: boolean;
    item: DragItem | null;
    startX: number;
    startY: number;
    startTime: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
}

export interface HoverTarget {
    type: 'grid' | 'inventory' | 'builder' | 'pool';
    index?: number;
}
