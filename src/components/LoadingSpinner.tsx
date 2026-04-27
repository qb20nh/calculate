import type { FunctionalComponent } from "preact";
import { useAppSettings } from "@/lib/appSettings";

interface LoadingSpinnerProps {
  isVisible?: boolean;
}

export const LoadingSpinner: FunctionalComponent<LoadingSpinnerProps> = ({ isVisible = true }) => {
  const { copy } = useAppSettings();
  if (!isVisible) return null;

  return (
    <output
      aria-label={copy.aria.loadingScreen}
      className="theme-page-bg fixed inset-0 z-[90] flex items-center justify-center"
    >
      <div className="size-16 animate-spin rounded-full border-4 theme-spinner" />
    </output>
  );
};
