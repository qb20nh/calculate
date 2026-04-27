import type { FunctionalComponent } from "preact";
import { useAppSettings } from "@/lib/appSettings";

export const AppChrome: FunctionalComponent = () => {
  const { copy, preferences, cycleThemePreference, toggleLocale } = useAppSettings();

  return (
    <div className="fixed right-3 top-3 z-[110] flex items-center gap-2">
      <button
        type="button"
        onClick={cycleThemePreference}
        className="theme-control-pill"
        aria-label={copy.aria.themeToggle}
        title={copy.aria.themeToggle}
      >
        <span className="theme-control-label">{copy.controlsTheme}</span>
        <span>{copy.themePreferenceLabel(preferences.theme)}</span>
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        className="theme-control-pill"
        aria-label={copy.aria.languageToggle}
        title={copy.aria.languageToggle}
      >
        <span className="theme-control-label">{copy.controlsLanguage}</span>
        <span>{copy.localeLabel(preferences.locale)}</span>
      </button>
    </div>
  );
};
