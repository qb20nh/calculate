import type { RefObject } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { TileData } from "@/services/math";

export const useInventoryScroll = (
  inventoryRef: RefObject<HTMLDivElement>,
  bank: TileData[] | undefined,
) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!inventoryRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = inventoryRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [bank]);

  return { canScrollLeft, canScrollRight, checkScroll };
};
