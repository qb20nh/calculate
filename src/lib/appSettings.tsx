import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";
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
import type { GameMode } from "@/services/storage";

type AppCopy = {
  appTitle: string;
  menuTitleMain: string;
  menuTitleAccent: string;
  menuSubtitle: string;
  selectDifficulty: string;
  difficultyLabel: (mode: GameMode) => string;
  difficultyDescription: (mode: GameMode, maxStage?: number) => string;
  controlsTheme: string;
  controlsLanguage: string;
  themePreferenceLabel: (theme: ThemePreference) => string;
  localeLabel: (locale: Locale) => string;
  game: {
    stageLabel: (mode: GameMode, stage: number) => string;
    previousStage: string;
    nextStage: string;
    back: string;
    resetStage: string;
    placeTileHere: string;
    stageLockedTitle: (stage: number) => string;
    stageLockedNotice: string;
    backToMenu: string;
    goToStage: (stage: number) => string;
    generatingPuzzle: string;
    bankEmpty: string;
    resetDialogTitle: string;
    resetDialogDescription: string;
    cancel: string;
    reset: string;
    successLabel: string;
    perfect: string;
    clearedBoard: string;
    dismiss: string;
    nextLevel: string;
    solutionTooLarge: string;
    validationReason: (reason: string) => string;
  };
  custom: {
    title: string;
    subtitle: string;
    givenCount: string;
    inventoryCount: string;
    sizeLimit: string;
    seed: string;
    seedPlaceholder: string;
    limitSolutionSize: string;
    limitSolutionSizeDescription: string;
    backToMenu: string;
    start: string;
    loadingTitle: string;
    retryLabel: (retryCount: number, totalRetries: number) => string;
    loadingHint: string;
    cancel: string;
    invalidUrl: string;
    generationError: string;
    couldNotRegenerate: string;
    validation: {
      givenCountPositive: string;
      inventoryCountPositive: string;
      sizeLimitPositive: string;
      settingsInvalid: string;
      totalTiles: string;
      sizeLimitMin: string;
      tileCountExceeds: string;
    };
  };
  notFound: {
    title: string;
    description: string;
    backToMenu: string;
  };
  aria: {
    loading: string;
    loadingScreen: string;
    themeToggle: string;
    languageToggle: string;
  };
};

const buildCopy = (locale: Locale): AppCopy => {
  if (locale === "ko") {
    const difficultyLabels = {
      Easy: "쉬움",
      Medium: "보통",
      Hard: "어려움",
      Custom: "사용자 지정",
    } as const;

    return {
      appTitle: "수학 크로스워드",
      menuTitleMain: "수학",
      menuTitleAccent: "크로스워드",
      menuSubtitle: "스크래블 방식",
      selectDifficulty: "난이도 선택",
      difficultyLabel: (mode) => difficultyLabels[mode],
      difficultyDescription: (mode, maxStage) => {
        if (mode === "Custom") return "정확한 개수, 크기, 시드 선택";
        return `최고 단계: ${maxStage ?? 1}`;
      },
      controlsTheme: "테마",
      controlsLanguage: "언어",
      themePreferenceLabel: (theme) => {
        if (theme === "light") return "라이트";
        if (theme === "dark") return "다크";
        return "시스템";
      },
      localeLabel: (value) => (value === "ko" ? "한국어" : "English"),
      game: {
        stageLabel: (mode, stage) => `${buildCopy("ko").difficultyLabel(mode)} — ${stage}단계`,
        previousStage: "이전 단계",
        nextStage: "다음 단계",
        back: "뒤로",
        resetStage: "단계 초기화",
        placeTileHere: "여기에 타일 놓기",
        stageLockedTitle: (stage) => `${stage}단계 잠김`,
        stageLockedNotice: "아직 열리지 않았습니다. 아래 버튼으로 나가거나 계속하세요.",
        backToMenu: "메뉴로",
        goToStage: (stage) => `${stage}단계로 이동`,
        generatingPuzzle: "퍼즐 생성 중...",
        bankEmpty: "타일 뱅크가 비었습니다.",
        resetDialogTitle: "이 단계를 초기화할까요?",
        resetDialogDescription: "현재 단계의 진행 상태가 사라집니다.",
        cancel: "취소",
        reset: "초기화",
        successLabel: "성공",
        perfect: "완벽",
        clearedBoard: "보드를 모두 맞췄습니다.",
        dismiss: "닫기",
        nextLevel: "다음 단계",
        solutionTooLarge: "제출한 해답이 설정한 크기 제한을 넘었습니다.",
        validationReason: (reason) => {
          if (reason === "Board is empty.") return "보드가 비어 있습니다.";
          if (reason === "No valid mathematical formula found.") {
            return "유효한 수식이 없습니다.";
          }
          if (reason === "At least two crossing formulas are required.") {
            return "서로 교차하는 수식이 최소 2개 필요합니다.";
          }
          if (reason.startsWith('Invalid formula: "')) {
            return `잘못된 수식: ${reason.slice("Invalid formula: ".length)}`;
          }
          return reason;
        },
      },
      custom: {
        title: "사용자 지정 게임",
        subtitle: "개수, 크기 제한, 시드를 직접 고르세요. URL에 설정이 유지됩니다.",
        givenCount: "제공 타일 수",
        inventoryCount: "뱅크 타일 수",
        sizeLimit: "보드 크기 제한",
        seed: "시드",
        seedPlaceholder: "비우거나 0이면 랜덤",
        limitSolutionSize: "제출 해답 크기도 제한",
        limitSolutionSizeDescription:
          "완성된 보드의 최종 가로 또는 세로가 지정한 제한을 넘으면 거부합니다.",
        backToMenu: "메뉴로 돌아가기",
        start: "사용자 지정 게임 시작",
        loadingTitle: "사용자 지정 게임 생성 중",
        retryLabel: (retryCount, totalRetries) => `재시도 ${retryCount} / ${totalRetries}`,
        loadingHint: "같은 시드로 유효한 보드를 찾을 때까지 워커가 계속 시도합니다.",
        cancel: "취소",
        invalidUrl: "URL의 사용자 지정 설정이 올바르지 않습니다.",
        generationError:
          "해당 설정으로 퍼즐을 생성할 수 없습니다. 더 큰 보드나 다른 시드를 사용하세요.",
        couldNotRegenerate: "사용자 지정 퍼즐을 다시 만들 수 없습니다.",
        validation: {
          givenCountPositive: "제공 타일 수는 양의 정수여야 합니다.",
          inventoryCountPositive: "뱅크 타일 수는 양의 정수여야 합니다.",
          sizeLimitPositive: "보드 크기 제한은 양의 정수여야 합니다.",
          settingsInvalid: "사용자 지정 옵션 설정이 올바르지 않습니다.",
          totalTiles: "최소 9개의 타일이 필요합니다.",
          sizeLimitMin: "보드 크기 제한은 최소 5여야 합니다.",
          tileCountExceeds: "타일 수가 보드 크기 제한을 초과합니다.",
        },
      },
      notFound: {
        title: "페이지를 찾을 수 없습니다",
        description: "이 퍼즐 경로는 존재하지 않습니다.",
        backToMenu: "메뉴로 돌아가기",
      },
      aria: {
        loading: "로딩",
        loadingScreen: "로딩 화면",
        themeToggle: "테마 전환",
        languageToggle: "언어 전환",
      },
    };
  }

  const difficultyLabels = {
    Easy: "Easy",
    Medium: "Medium",
    Hard: "Hard",
    Custom: "Custom",
  } as const;

  return {
    appTitle: "Math Crossword",
    menuTitleMain: "Math",
    menuTitleAccent: "Crossword",
    menuSubtitle: "Scrabble Edition",
    selectDifficulty: "Select Difficulty",
    difficultyLabel: (mode) => difficultyLabels[mode],
    difficultyDescription: (mode, maxStage) => {
      if (mode === "Custom") return "Pick counts, size, seed";
      return `Max Stage: ${maxStage ?? 1}`;
    },
    controlsTheme: "Theme",
    controlsLanguage: "Language",
    themePreferenceLabel: (theme) => {
      if (theme === "light") return "Light";
      if (theme === "dark") return "Dark";
      return "Auto";
    },
    localeLabel: (value) => (value === "ko" ? "Korean" : "English"),
    game: {
      stageLabel: (mode, stage) => `${buildCopy("en").difficultyLabel(mode)} — Stage ${stage}`,
      previousStage: "Previous Stage",
      nextStage: "Next Stage",
      back: "Back",
      resetStage: "Reset Stage",
      placeTileHere: "Place tile here",
      stageLockedTitle: (stage) => `Stage ${stage} locked`,
      stageLockedNotice:
        "This level is not unlocked yet. Use the buttons below to leave or continue.",
      backToMenu: "Back to menu",
      goToStage: (stage) => `Go to stage ${stage}`,
      generatingPuzzle: "Generating Puzzle...",
      bankEmpty: "Bank is empty.",
      resetDialogTitle: "Reset this stage?",
      resetDialogDescription: "Current progress on this stage will be lost.",
      cancel: "Cancel",
      reset: "Reset",
      successLabel: "Success",
      perfect: "Perfect!",
      clearedBoard: "You cleared the board.",
      dismiss: "Dismiss",
      nextLevel: "Next level",
      solutionTooLarge: "Submitted solution exceeds the configured size limit.",
      validationReason: (reason) => {
        if (reason.startsWith('Invalid formula: "')) return reason;
        return reason;
      },
    },
    custom: {
      title: "Custom Game",
      subtitle: "Pick exact counts, size limit, and seed. URL will keep setup.",
      givenCount: "Given count",
      inventoryCount: "Inventory tile count",
      sizeLimit: "Board size limit",
      seed: "Seed",
      seedPlaceholder: "blank or 0 = random",
      limitSolutionSize: "Limit submitted solution size too",
      limitSolutionSizeDescription:
        "Reject a solved board if its final width or height exceeds the configured limit.",
      backToMenu: "Back to menu",
      start: "Start custom game",
      loadingTitle: "Generating custom game",
      retryLabel: (retryCount, totalRetries) => `Retry ${retryCount} / ${totalRetries}`,
      loadingHint: "Worker retries same seeded generator until it finds valid board or hits limit.",
      cancel: "Cancel",
      invalidUrl: "Invalid custom settings in URL.",
      generationError:
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
      couldNotRegenerate: "Could not regenerate custom puzzle.",
      validation: {
        givenCountPositive: "Given count must be a positive whole number.",
        inventoryCountPositive: "Inventory tile count must be a positive whole number.",
        sizeLimitPositive: "Board size limit must be a positive whole number.",
        settingsInvalid: "Custom option settings are invalid.",
        totalTiles: "Need at least 9 total tiles.",
        sizeLimitMin: "Board size limit must be at least 5.",
        tileCountExceeds: "Tile count exceeds board size limit.",
      },
    },
    notFound: {
      title: "Page not found",
      description: "This puzzle route does not exist.",
      backToMenu: "Back to menu",
    },
    aria: {
      loading: "Loading",
      loadingScreen: "Loading screen",
      themeToggle: "Toggle theme",
      languageToggle: "Toggle language",
    },
  };
};

type AppSettingsValue = {
  preferences: AppPreferences;
  resolvedTheme: ResolvedTheme;
  copy: AppCopy;
  setThemePreference: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  cycleThemePreference: () => void;
  toggleLocale: () => void;
};

const defaultCopy = buildCopy(DEFAULT_APP_PREFERENCES.locale);

const AppSettingsContext = createContext<AppSettingsValue>({
  preferences: DEFAULT_APP_PREFERENCES,
  resolvedTheme: "light",
  copy: defaultCopy,
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
  const copy = useMemo(() => buildCopy(preferences.locale), [preferences.locale]);

  useEffect(() => {
    syncDocumentPreferences(preferences, resolvedTheme);
    document.title = copy.appTitle;
  }, [copy.appTitle, preferences, resolvedTheme]);

  const value = useMemo<AppSettingsValue>(
    () => ({
      preferences,
      resolvedTheme,
      copy,
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
    [copy, preferences, resolvedTheme],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export const useAppSettings = () => useContext(AppSettingsContext);
