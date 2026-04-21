export type CellType = 'empty' | 'block'

export interface GridCell {
  id: string;
  type: CellType;
  char: string | null;
}

export interface TileItem {
  id: number | string;
  char: string;
}

export interface Level {
  id: number;
  displayTitle: string;
  displaySubtitle: string;
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

export type ViewType = 'menu' | 'main' | 'daily'

export interface DragItem {
  source: 'inventory' | 'grid' | 'pool' | 'builder';
  char: string;
  index?: number;
}

export interface HoverTarget {
  type: 'grid' | 'inventory' | 'pool' | 'builder';
  index?: number;
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
