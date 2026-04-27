import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { createTranslate, MESSAGES, type Messages, type TFunction } from "@/lib/i18n";
import {
  type AppPreferences,
  DEFAULT_APP_PREFERENCES,
  getSystemTheme,
  type Locale,
  loadAppPreferences,
  type ResolvedTheme,
  resolveTheme,
  saveAppPreferences,
  syncDocumentPreferences,
  type ThemePreference,
} from "@/services/preferences";

type AppSettingsValue = {
  preferences: AppPreferences;
  resolvedTheme: ResolvedTheme;
  copy: Messages;
  t: TFunction;
  setThemePreference: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  cycleThemePreference: () => void;
  toggleLocale: () => void;
};

const defaultCopy = MESSAGES[DEFAULT_APP_PREFERENCES.locale];
const defaultT = createTranslate(DEFAULT_APP_PREFERENCES.locale);

const AppSettingsContext = createContext<AppSettingsValue>({
  preferences: DEFAULT_APP_PREFERENCES,
  resolvedTheme: "light",
  copy: defaultCopy,
  t: defaultT,
  setThemePreference: () => {},
  setLocale: () => {},
  cycleThemePreference: () => {},
  toggleLocale: () => {},
});

export function AppSettingsProvider({ children }: Readonly<{ children: ComponentChildren }>) {
  const [preferences, setPreferences] = useState<AppPreferences>(loadAppPreferences);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    saveAppPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    if (!media) return;

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(media.matches ? "dark" : "light");

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const resolvedTheme = resolveTheme(preferences.theme, systemTheme === "dark");
  const copy = useMemo(() => MESSAGES[preferences.locale], [preferences.locale]);
  const t = useMemo(() => createTranslate(preferences.locale), [preferences.locale]);

  useEffect(() => {
    syncDocumentPreferences(preferences, resolvedTheme);
    document.title = copy.appTitle;
  }, [copy.appTitle, preferences, resolvedTheme]);

  const value = useMemo<AppSettingsValue>(
    () => ({
      preferences,
      resolvedTheme,
      copy,
      t,
      setThemePreference: (theme) => setPreferences((prev) => ({ ...prev, theme })),
      setLocale: (locale) => setPreferences((prev) => ({ ...prev, locale })),
      cycleThemePreference: () =>
        setPreferences((prev) => ({
          ...prev,
          theme: prev.theme === "system" ? "light" : prev.theme === "light" ? "dark" : "system",
        })),
      toggleLocale: () =>
        setPreferences((prev) => ({ ...prev, locale: prev.locale === "en" ? "ko" : "en" })),
    }),
    [copy, preferences, resolvedTheme, t],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export const useAppSettings = () => useContext(AppSettingsContext);
