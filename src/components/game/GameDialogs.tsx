import { Check } from "lucide-preact";
import type { FunctionalComponent, RefObject } from "preact";
import { useAppSettings } from "@/lib/appSettings";

export const ResetDialog: FunctionalComponent<{
  dialogRef: RefObject<HTMLDialogElement>;
  cancelRef: RefObject<HTMLButtonElement>;
  supportsModalDialog: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ dialogRef, cancelRef, supportsModalDialog, isOpen, onCancel, onConfirm }) => {
  const { copy } = useAppSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <dialog
        ref={dialogRef}
        open={!supportsModalDialog && isOpen}
        className="m-auto rounded-3xl theme-panel p-0 shadow-2xl animate-fade-in block"
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-desc"
      >
        <div className="max-w-sm p-8 text-center">
          <h2 id="reset-dialog-title" className="text-2xl font-black tracking-tight">
            {copy.game.resetDialogTitle}
          </h2>
          <p id="reset-dialog-desc" className="mt-3 theme-muted-text font-medium">
            {copy.game.resetDialogDescription}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl theme-btn-secondary px-5 py-3 font-bold text-[var(--theme-ink)] transition hover:bg-black/5 active:scale-95"
            >
              {copy.game.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-2xl theme-danger-bg text-white px-5 py-3 font-bold shadow-xl transition active:scale-95"
            >
              {copy.game.reset}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export const CompletionDialog: FunctionalComponent<{
  dialogRef: RefObject<HTMLDialogElement>;
  dismissRef: RefObject<HTMLButtonElement>;
  supportsModalDialog: boolean;
  isOpen: boolean;
  showNextLevelButton: boolean;
  onDismiss: () => void;
  onNextLevel: () => void;
}> = ({
  dialogRef,
  dismissRef,
  supportsModalDialog,
  isOpen,
  showNextLevelButton,
  onDismiss,
  onNextLevel,
}) => {
  const { copy } = useAppSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <dialog
        ref={dialogRef}
        open={!supportsModalDialog && isOpen}
        className="m-auto rounded-[2rem] theme-panel p-0 shadow-2xl animate-fade-in block"
        aria-labelledby="completion-dialog-title"
        aria-describedby="completion-dialog-desc"
      >
        <div className="max-w-xs w-full p-10 text-center">
          <div className="mx-auto w-20 h-20 theme-number-bg-soft rounded-full flex items-center justify-center mb-6">
            <Check
              width={40}
              height={40}
              strokeWidth={3}
              className="theme-number-text"
              aria-label={copy.game.successLabel}
            />
          </div>
          <h2 id="completion-dialog-title" className="text-3xl font-black mb-2 tracking-tight">
            {copy.game.perfect}
          </h2>
          <p id="completion-dialog-desc" className="theme-muted-text mb-8 font-medium">
            {copy.game.clearedBoard}
          </p>
          <div className="w-full flex flex-col gap-3">
            <button
              ref={dismissRef}
              type="button"
              onClick={onDismiss}
              className="w-full border theme-border hover:bg-black/5 theme-muted-text font-bold py-4 px-8 rounded-2xl shadow-sm transform transition active:scale-95 text-lg"
            >
              {copy.game.dismiss}
            </button>
            {showNextLevelButton && (
              <button
                type="button"
                onClick={onNextLevel}
                className="w-full theme-primary-bg text-white font-bold py-4 px-8 rounded-2xl shadow-xl transform transition active:scale-95 text-lg"
              >
                {copy.game.nextLevel}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
};
