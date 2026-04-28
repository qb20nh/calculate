import { useCallback, useLayoutEffect, useRef } from "preact/hooks";
import { TILE_SIZE } from "@/components/game/gameUtils";
import type { GameState } from "@/services/storage";

export const useBoardPan = (gameState: GameState | null) => {
  const panOffset = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const initialPointer = useRef({ x: 0, y: 0 });
  const panContainerRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef({ minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 });
  const hasDragged = useRef(false);
  const prevGridMetrics = useRef({
    minC: 0,
    minR: 0,
    cols: 0,
    rows: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    initialized: false,
  });

  const clampPan = (x: number, y: number) => {
    const { minX, maxX, minY, maxY } = boundsRef.current;
    const cx = minX <= maxX ? Math.max(minX, Math.min(maxX, x)) : 0;
    const cy = minY <= maxY ? Math.max(minY, Math.min(maxY, y)) : 0;
    return { x: cx, y: cy };
  };

  const updatePan = (x: number, y: number) => {
    const clamped = clampPan(x, y);
    panOffset.current = clamped;
    if (panContainerRef.current) {
      const rx = Math.round(clamped.x);
      const ry = Math.round(clamped.y);
      panContainerRef.current.style.transform = `translate(${rx}px, ${ry}px)`;
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    isPanning.current = true;
    hasDragged.current = false;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    initialPointer.current = { x: event.clientX, y: event.clientY };
    if (boardContainerRef.current?.setPointerCapture) {
      boardContainerRef.current.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isPanning.current) return;

    if (!hasDragged.current) {
      const totalDx = event.clientX - initialPointer.current.x;
      const totalDy = event.clientY - initialPointer.current.y;
      if (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4) {
        hasDragged.current = true;
      }
    }

    if (hasDragged.current) {
      const dx = event.clientX - lastPointer.current.x;
      const dy = event.clientY - lastPointer.current.y;
      updatePan(panOffset.current.x + dx, panOffset.current.y + dy);
    }

    lastPointer.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent) => {
    isPanning.current = false;
    if (boardContainerRef.current?.hasPointerCapture?.(event.pointerId)) {
      boardContainerRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleCaptureClick = (event: MouseEvent) => {
    if (hasDragged.current) {
      event.stopPropagation();
      event.preventDefault();
      hasDragged.current = false;
    }
  };

  const resetGridMetrics = useCallback(() => {
    prevGridMetrics.current.initialized = false;
  }, []);

  useLayoutEffect(() => {
    const calc = () => {
      if (!boardContainerRef.current || gameState?.status !== "playing") return;

      const placedAndGivenKeys = Object.keys(gameState.board);
      if (placedAndGivenKeys.length === 0) return;

      const fringe = new Set<string>();
      for (const key of placedAndGivenKeys) {
        const [rStr, cStr] = key.split(",");
        const r = Number(rStr);
        const c = Number(cStr);
        const neighbors = [`${r + 1},${c}`, `${r - 1},${c}`, `${r},${c + 1}`, `${r},${c - 1}`];
        for (const neighborKey of neighbors) {
          if (!gameState.board[neighborKey]) fringe.add(neighborKey);
        }
      }

      const allRelevantKeys = [...placedAndGivenKeys, ...Array.from(fringe)];
      let minR = Infinity;
      let maxR = -Infinity;
      let minC = Infinity;
      let maxC = -Infinity;
      for (const key of allRelevantKeys) {
        const [rStr, cStr] = key.split(",");
        const r = Number(rStr);
        const c = Number(cStr);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }

      minR -= 1;
      maxR += 1;
      minC -= 1;
      maxC += 1;

      const cols = maxC - minC + 1;
      const rows = maxR - minR + 1;

      let pMinR = Infinity;
      let pMaxR = -Infinity;
      let pMinC = Infinity;
      let pMaxC = -Infinity;
      for (const key of placedAndGivenKeys) {
        const [rStr, cStr] = key.split(",");
        const r = Number(rStr);
        const c = Number(cStr);
        pMinR = Math.min(pMinR, r);
        pMaxR = Math.max(pMaxR, r);
        pMinC = Math.min(pMinC, c);
        pMaxC = Math.max(pMaxC, c);
      }
      const viewportWidth = boardContainerRef.current.clientWidth || 300;
      const viewportHeight = boardContainerRef.current.clientHeight || 300;

      let curPanX = panOffset.current.x;
      let curPanY = panOffset.current.y;

      if (prevGridMetrics.current.initialized) {
        curPanX += (minC - prevGridMetrics.current.minC) * TILE_SIZE;
        curPanY += (minR - prevGridMetrics.current.minR) * TILE_SIZE;

        const dw = viewportWidth - prevGridMetrics.current.viewportWidth;
        const dh = viewportHeight - prevGridMetrics.current.viewportHeight;
        curPanX += dw / 2;
        curPanY += dh / 2;
      } else {
        curPanX = viewportWidth / 2 - (cols * TILE_SIZE) / 2;
        curPanY = viewportHeight / 2 - (rows * TILE_SIZE) / 2;
      }

      prevGridMetrics.current = {
        minC,
        minR,
        cols,
        rows,
        viewportWidth,
        viewportHeight,
        initialized: true,
      };

      const pMinX = (pMinC - minC) * TILE_SIZE;
      const pMaxX = (pMaxC - minC + 1) * TILE_SIZE;
      const pMinY = (pMinR - minR) * TILE_SIZE;
      const pMaxY = (pMaxR - minR + 1) * TILE_SIZE;

      const minX = TILE_SIZE - pMaxX;
      const maxX = viewportWidth - TILE_SIZE - pMinX;
      const minY = TILE_SIZE - pMaxY;
      const maxY = viewportHeight - TILE_SIZE - pMinY;

      boundsRef.current = { minX, maxX, minY, maxY };
      updatePan(curPanX, curPanY);
    };

    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [gameState?.board, gameState?.status]);

  return {
    boardContainerRef,
    panContainerRef,
    panOffset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCaptureClick,
    resetGridMetrics,
  };
};
