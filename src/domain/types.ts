export type CellType = 'empty' | 'block';

export interface GridCell {
    type: CellType;
    char: string | null;
}

export interface TileItem {
    id: number | string;
    char: string;
}

export interface Level {
    id: number;
    name: string;
    rows: number;
    cols: number;
    layout: number[];
    inventory: string[];
    description: string;
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

export type ViewType = 'menu' | 'main' | 'daily';

export interface DragItem {
    source: 'inventory' | 'grid' | 'pool' | 'builder';
    char: string;
    index?: number;
}

export interface HoverTarget {
    type: 'grid' | 'inventory' | 'pool' | 'builder';
    index?: number;
}
