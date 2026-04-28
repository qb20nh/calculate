import type { Locale } from "@/services/preferences";

/**
 * Static translation data.
 * Patterns like {{variable}} are used for interpolation.
 */
export const MESSAGES = {
  ko: {
    appTitle: "수학 크로스워드",
    menuTitleMain: "수학",
    menuTitleAccent: "크로스워드",
    menuSubtitle: "스크래블 방식",
    selectDifficulty: "난이도 선택",
    difficulty: {
      Easy: "쉬움",
      Medium: "보통",
      Hard: "어려움",
      Custom: "사용자 지정",
    },
    difficultyDescription: {
      Custom: "정확한 개수, 크기, 시드 선택",
      Standard: "최고 단계: {{maxStage}}",
    },
    controlsTheme: "테마",
    controlsLanguage: "언어",
    themePreference: {
      light: "라이트",
      dark: "다크",
      system: "시스템",
    },
    localeLabel: {
      ko: "한국어",
      en: "English",
    },
    game: {
      stageLabel: "{{difficulty}} - {{stage}}단계",
      previousStage: "이전 단계",
      nextStage: "다음 단계",
      back: "뒤로",
      resetStage: "단계 초기화",
      placeTileHere: "여기에 타일 놓기",
      stageLockedTitle: "{{stage}}단계 잠김",
      stageLockedNotice: "아직 열리지 않았습니다. 아래 버튼으로 나가거나 계속하세요.",
      backToMenu: "메뉴로",
      goToStage: "{{stage}}단계로 이동",
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
      validation: {
        boardEmpty: "보드가 비어 있습니다.",
        noFormula: "유효한 수식이 없습니다.",
        noCrossing: "서로 교차하는 수식이 최소 2개 필요합니다.",
        invalidFormula: "잘못된 수식: {{formula}}",
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
      retryLabel: "재시도 {{retryCount}} / {{totalRetries}}",
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
        sizeLimitMax: "보드 크기 제한은 최대 20입니다.",
        tileCountExceeds: "타일 수가 보드 크기 제한을 초과합니다.",
        seedTooLong: "시드는 64자 이하여야 합니다.",
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
  },
  en: {
    appTitle: "Math Crossword",
    menuTitleMain: "Math",
    menuTitleAccent: "Crossword",
    menuSubtitle: "Scrabble Edition",
    selectDifficulty: "Select Difficulty",
    difficulty: {
      Easy: "Easy",
      Medium: "Medium",
      Hard: "Hard",
      Custom: "Custom",
    },
    difficultyDescription: {
      Custom: "Pick counts, size, seed",
      Standard: "Max Stage: {{maxStage}}",
    },
    controlsTheme: "Theme",
    controlsLanguage: "Language",
    themePreference: {
      light: "Light",
      dark: "Dark",
      system: "Auto",
    },
    localeLabel: {
      ko: "Korean",
      en: "English",
    },
    game: {
      stageLabel: "{{difficulty}} - Stage {{stage}}",
      previousStage: "Previous Stage",
      nextStage: "Next Stage",
      back: "Back",
      resetStage: "Reset Stage",
      placeTileHere: "Place tile here",
      stageLockedTitle: "Stage {{stage}} locked",
      stageLockedNotice:
        "This level is not unlocked yet. Use the buttons below to leave or continue.",
      backToMenu: "Back to menu",
      goToStage: "Go to stage {{stage}}",
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
      validation: {
        boardEmpty: "Board is empty.",
        noFormula: "No valid mathematical formula found.",
        noCrossing: "At least two crossing formulas are required.",
        invalidFormula: 'Invalid formula: "{{formula}}"',
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
      retryLabel: "Retry {{retryCount}} / {{totalRetries}}",
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
        sizeLimitMax: "Board size limit must be at most 20.",
        tileCountExceeds: "Tile count exceeds board size limit.",
        seedTooLong: "Seed must be 64 characters or fewer.",
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
  },
};

export type Messages = typeof MESSAGES.en;

export type TFunction = (key: string, options?: Record<string, string | number>) => string;

/**
 * Creates a translation function for the given locale.
 * Supports nested keys (e.g. "game.successLabel") and pattern interpolation (e.g. "{{stage}}").
 */
export const createTranslate = (locale: Locale): TFunction => {
  const messages = MESSAGES[locale];

  return (key: string, options?: Record<string, string | number>) => {
    const parts = key.split(".");
    let value: unknown = messages;

    for (const part of parts) {
      if (value === undefined || value === null) return key;
      value = (value as Record<string, unknown>)[part];
    }

    if (typeof value !== "string") return key;

    if (options) {
      return Object.entries(options).reduce((acc, [k, v]) => {
        return acc.replaceAll(new RegExp(`{{${k}}}`, "g"), String(v));
      }, value);
    }

    return value;
  };
};
