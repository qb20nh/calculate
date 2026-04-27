export type ThemePreference = "system" | "light" | "dark";
export type Locale = "en" | "ko";
export type ResolvedTheme = "light" | "dark";

export interface AppPreferences {
  theme: ThemePreference;
  locale: Locale;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: "system",
  locale: "en",
};

const STORAGE_KEY = "math_scrabble_prefs";

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const isLocale = (value: unknown): value is Locale => value === "en" || value === "ko";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const loadAppPreferences = (): AppPreferences => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_APP_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PREFERENCES;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return DEFAULT_APP_PREFERENCES;

    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_APP_PREFERENCES.theme,
      locale: isLocale(parsed.locale) ? parsed.locale : DEFAULT_APP_PREFERENCES.locale,
    };
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
};

export const saveAppPreferences = (preferences: AppPreferences) => {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore private mode or quota failures.
  }
};

export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme => {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return prefersDark ? "dark" : "light";
};

export const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const syncDocumentPreferences = (
  preferences: AppPreferences,
  resolvedTheme: ResolvedTheme,
): void => {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.lang = preferences.locale;
  document.documentElement.style.colorScheme = resolvedTheme;
};
