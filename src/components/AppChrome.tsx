import { Languages, Monitor, Moon, SunMedium } from "lucide-preact";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { useAppSettings } from "@/lib/appSettings";

export const AppChrome: FunctionalComponent = () => {
  const { path } = useLocation();
  const { copy, preferences, cycleThemePreference, toggleLocale } = useAppSettings();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated || path !== "/") return null;
  const themeIcon =
    preferences.theme === "system" ? (
      <Monitor width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    ) : preferences.theme === "dark" ? (
      <Moon width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    ) : (
      <SunMedium width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    );

  return (
    <div className="fixed right-3 top-3 z-[110] flex items-center gap-2">
      <button
        type="button"
        onClick={cycleThemePreference}
        className="theme-control-pill"
        aria-label={copy.aria.themeToggle}
        title={copy.aria.themeToggle}
        data-testid="theme-toggle"
      >
        {themeIcon}
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        className="theme-control-pill"
        aria-label={copy.aria.languageToggle}
        title={copy.aria.languageToggle}
        data-testid="language-toggle"
      >
        <Languages width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
};
