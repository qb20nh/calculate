import { Languages, Monitor, Moon, SunMedium } from "lucide-preact";
import type { FunctionalComponent } from "preact";
import { useAppSettings } from "@/lib/appSettings";

export const AppChrome: FunctionalComponent = () => {
  const { copy, preferences, cycleThemePreference, toggleLocale } = useAppSettings();
  const themeIcon =
    preferences.theme === "dark" ? (
      <Moon width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    ) : preferences.theme === "light" ? (
      <SunMedium width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    ) : (
      <Monitor width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
    );

  return (
    <div className="fixed right-3 top-3 z-[110] flex items-center gap-2">
      <button
        type="button"
        onClick={cycleThemePreference}
        className="theme-control-pill"
        aria-label={copy.aria.themeToggle}
        title={copy.aria.themeToggle}
      >
        {themeIcon}
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        className="theme-control-pill"
        aria-label={copy.aria.languageToggle}
        title={copy.aria.languageToggle}
      >
        <Languages width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
};
