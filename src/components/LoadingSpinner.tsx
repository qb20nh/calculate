import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useAppSettings } from "@/lib/appSettings";

interface LoadingSpinnerProps {
  isVisible?: boolean;
}

const fadeOutMs = 240;

export const LoadingSpinner: FunctionalComponent<LoadingSpinnerProps> = ({ isVisible = true }) => {
  const { copy } = useAppSettings();
  const [isRendered, setIsRendered] = useState(isVisible);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
      setIsFading(false);
      return;
    }

    if (!isRendered) return;

    setIsFading(true);
    const fadeTimer = setTimeout(() => {
      setIsRendered(false);
    }, fadeOutMs);

    return () => clearTimeout(fadeTimer);
  }, [isVisible, isRendered]);

  if (!isRendered) return null;

  return (
    <output
      aria-label={copy.aria.loadingScreen}
      className={[
        "theme-page-bg loading-screen fixed inset-0 z-[90] flex items-center justify-center",
        isFading ? "loading-screen-fading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="size-16 animate-spin rounded-full border-4 theme-spinner" />
    </output>
  );
};
