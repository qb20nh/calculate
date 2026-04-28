import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

export const useDialogFocus = ({
  isDialogOpen,
  isResetDialogOpen,
  resetCancelRef,
  completionDismissRef,
}: {
  isDialogOpen: boolean;
  isResetDialogOpen: boolean;
  resetCancelRef: RefObject<HTMLButtonElement>;
  completionDismissRef: RefObject<HTMLButtonElement>;
}) => {
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isDialogOpen) {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initialFocus = isResetDialogOpen ? resetCancelRef.current : completionDismissRef.current;
    initialFocus?.focus();
  }, [isDialogOpen, isResetDialogOpen, resetCancelRef, completionDismissRef]);
};
