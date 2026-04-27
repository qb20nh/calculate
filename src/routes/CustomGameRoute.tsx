import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import {
  addBasePath,
  parseCustomGameConfig,
  parseCustomGameRetryCount,
  toCustomGamePath,
} from "@/routes/routeUtils";
import { generateCustomGame } from "@/services/board";
import {
  CUSTOM_GAME_RETRY_LIMIT,
  type CustomGameGenerationMessage,
  type CustomGameWorkerHandle,
  createCustomGameWorker,
} from "@/services/customGameGeneration";
import type { CustomGameConfig, GameState } from "@/services/storage";
import { loadGameState, saveGameState } from "@/services/storage";

const DEFAULT_CUSTOM_CONFIG: CustomGameConfig = {
  givenCount: 8,
  inventoryCount: 12,
  sizeLimit: 10,
  seed: "",
  limitSolutionSize: false,
};

const readRandomSeed = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(buf[0] ?? Date.now());
  }
  return String(Date.now());
};

const normalizeSeed = (rawSeed: string) => {
  const trimmed = rawSeed.trim();
  if (trimmed === "" || trimmed === "0") {
    return readRandomSeed();
  }
  return trimmed;
};

const sameCustomConfig = (left: CustomGameConfig | null | undefined, right: CustomGameConfig) =>
  !!left &&
  left.givenCount === right.givenCount &&
  left.inventoryCount === right.inventoryCount &&
  left.sizeLimit === right.sizeLimit &&
  left.seed === right.seed &&
  (left.limitSolutionSize ?? false) === right.limitSolutionSize &&
  left.attempt === right.attempt;

const isValidCustomConfig = (
  config: CustomGameConfig,
  validation: {
    givenCountPositive: string;
    inventoryCountPositive: string;
    sizeLimitPositive: string;
    settingsInvalid: string;
    totalTiles: string;
    sizeLimitMin: string;
    tileCountExceeds: string;
  },
) => {
  if (!Number.isSafeInteger(config.givenCount) || config.givenCount <= 0) {
    return validation.givenCountPositive;
  }
  if (!Number.isSafeInteger(config.inventoryCount) || config.inventoryCount <= 0) {
    return validation.inventoryCountPositive;
  }
  if (!Number.isSafeInteger(config.sizeLimit) || config.sizeLimit <= 0) {
    return validation.sizeLimitPositive;
  }
  if (typeof config.limitSolutionSize !== "boolean") {
    return validation.settingsInvalid;
  }
  if (config.givenCount + config.inventoryCount < 9) {
    return validation.totalTiles;
  }
  if (config.sizeLimit < 5) {
    return validation.sizeLimitMin;
  }
  if (config.givenCount + config.inventoryCount > config.sizeLimit * config.sizeLimit) {
    return validation.tileCountExceeds;
  }
  return null;
};

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ComponentChildren;
};

const Field = ({ label, htmlFor, children }: FieldProps) => (
  <div className="grid gap-2">
    <label htmlFor={htmlFor} className="text-sm font-bold theme-muted-text">
      {label}
    </label>
    {children}
  </div>
);

function CustomGameSetup({
  draft,
  error,
  onBackToMenu,
  onDraftChange,
  onSubmit,
}: Readonly<{
  draft: CustomGameConfig;
  error: string | null;
  onBackToMenu: () => void;
  onDraftChange: (next: CustomGameConfig) => void;
  onSubmit: () => void;
}>) {
  const { copy } = useAppSettings();
  useAppReadinessSignal(true, "custom-setup");

  return (
    <div className="theme-page-bg h-dvh w-full flex items-center justify-center p-4">
      <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-xl md:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{copy.custom.title}</h1>
            <p className="mt-2 font-medium theme-muted-text">{copy.custom.subtitle}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <Field label={copy.custom.givenCount} htmlFor="custom-given-count">
            <input
              id="custom-given-count"
              type="number"
              min="1"
              step="1"
              value={draft.givenCount}
              onInput={(e) =>
                onDraftChange({
                  ...draft,
                  givenCount: Number(e.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.inventoryCount} htmlFor="custom-inventory-count">
            <input
              id="custom-inventory-count"
              type="number"
              min="1"
              step="1"
              value={draft.inventoryCount}
              onInput={(e) =>
                onDraftChange({
                  ...draft,
                  inventoryCount: Number(e.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.sizeLimit} htmlFor="custom-size-limit">
            <input
              id="custom-size-limit"
              type="number"
              min="1"
              step="1"
              value={draft.sizeLimit}
              onInput={(e) =>
                onDraftChange({
                  ...draft,
                  sizeLimit: Number(e.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.seed} htmlFor="custom-seed">
            <input
              id="custom-seed"
              type="text"
              value={draft.seed}
              onInput={(e) =>
                onDraftChange({
                  ...draft,
                  seed: e.currentTarget.value,
                })
              }
              placeholder={copy.custom.seedPlaceholder}
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <div className="theme-panel rounded-2xl p-4">
            <label className="flex gap-3">
              <input
                id="custom-limit-solution-size"
                type="checkbox"
                checked={draft.limitSolutionSize}
                onChange={(e) =>
                  onDraftChange({
                    ...draft,
                    limitSolutionSize: e.currentTarget.checked,
                  })
                }
                className="mt-1 h-4 w-4 shrink-0 rounded border theme-border text-[var(--theme-ink)]"
              />
              <span className="text-sm font-bold">{copy.custom.limitSolutionSize}</span>
            </label>
            <p className="mt-2 text-sm leading-6 theme-muted-text">
              {copy.custom.limitSolutionSizeDescription}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="rounded-2xl border theme-border px-5 py-4 font-bold transition active:scale-95"
          >
            {copy.custom.backToMenu}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-2xl theme-primary-bg px-5 py-4 font-bold text-white shadow-xl transition active:scale-95"
          >
            {copy.custom.start}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomGameLoading({
  retryCount,
  onCancel,
}: Readonly<{ retryCount: number; onCancel: () => void }>) {
  const { copy, t } = useAppSettings();
  useAppReadinessSignal(false, "custom-loading");

  return (
    <div className="theme-page-bg h-dvh w-full flex items-center justify-center p-4">
      <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4">
          <div
            id="custom-generation-spinner"
            className="size-14 animate-spin rounded-full border-4 theme-spinner"
          />
          <div className="grid gap-1">
            <h1 className="text-2xl font-black tracking-tight">{copy.custom.loadingTitle}</h1>
            <p className="font-medium theme-muted-text">
              {t("custom.retryLabel", { retryCount, totalRetries: CUSTOM_GAME_RETRY_LIMIT })}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl theme-panel-strong px-4 py-3 text-sm font-medium">
          {copy.custom.loadingHint}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-6 w-full rounded-2xl border theme-border px-5 py-4 font-bold transition active:scale-95"
        >
          {copy.custom.cancel}
        </button>
      </div>
    </div>
  );
}

export default function CustomGameRoute() {
  const { copy } = useAppSettings();
  const location = useLocation();
  const searchParams = useMemo(
    () => new URL(location.url, "http://localhost").searchParams,
    [location.url],
  );
  const parsedConfig = useMemo(() => parseCustomGameConfig(searchParams), [searchParams]);
  const parsedRetryCount = useMemo(() => parseCustomGameRetryCount(searchParams), [searchParams]);
  const hasRetryCountInUrl = useMemo(() => searchParams.has("retryCount"), [searchParams]);

  const savedState = useMemo(() => loadGameState(), []);
  const savedCustomConfig = savedState?.difficulty === "Custom" ? savedState.customConfig : null;

  // We only resume from storage if the URL does NOT have an explicit retryCount,
  // or if the storage matches the URL's specific attempt.
  const resumeSavedGame = useMemo(() => {
    if (!parsedConfig) return null;
    if (hasRetryCountInUrl) {
      return savedState && sameCustomConfig(savedCustomConfig, parsedConfig) ? savedState : null;
    }
    // If no retryCount in URL, we can resume any saved game that matches the basic settings
    if (
      savedState &&
      savedCustomConfig &&
      savedCustomConfig.seed === parsedConfig.seed &&
      savedCustomConfig.givenCount === parsedConfig.givenCount &&
      savedCustomConfig.inventoryCount === parsedConfig.inventoryCount
    ) {
      return savedState;
    }
    return null;
  }, [savedState, savedCustomConfig, parsedConfig, hasRetryCountInUrl]);

  const [draft, setDraft] = useState<CustomGameConfig>(parsedConfig ?? DEFAULT_CUSTOM_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CustomGameConfig | null>(() => {
    if (parsedConfig) return parsedConfig;
    return null;
  });

  const [gameState, setGameState] = useState<GameState | null>(() => {
    if (resumeSavedGame) return resumeSavedGame;
    // INSTANT GENERATION: Try synchronous generation if specific retryCount is in URL
    if (parsedConfig && hasRetryCountInUrl) {
      return generateCustomGame(parsedConfig, parsedRetryCount);
    }
    return null;
  });

  const [isGenerating, setIsGenerating] = useState(() => {
    if (gameState) return false;
    return parsedConfig !== null && hasRetryCountInUrl;
  });
  const [retryCount, setRetryCount] = useState(parsedRetryCount);
  const [error, setError] = useState<string | null>(
    parsedConfig === null && searchParams.toString().length > 0 ? copy.custom.invalidUrl : null,
  );

  const workerRef = useRef<CustomGameWorkerHandle | null>(null);
  const resumeStartedRef = useRef(false);

  const syncCustomUrl = useCallback((config: CustomGameConfig, nextRetryCount: number) => {
    if (typeof window === "undefined") return;

    const nextPath = addBasePath(toCustomGamePath(config, nextRetryCount));
    const currentPath = window.location.pathname + window.location.search;

    // Use URL objects to normalize comparison if needed, but for now simple string check
    if (currentPath !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => () => terminateWorker(), [terminateWorker]);

  const startGeneration = useCallback(
    (config: CustomGameConfig, startRetryCount: number) => {
      terminateWorker();
      setError(null);
      setIsGenerating(true);
      setRetryCount(startRetryCount);

      try {
        const worker = createCustomGameWorker();
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<CustomGameGenerationMessage>) => {
          const message = event.data;
          if (message.type === "progress") {
            if (message.retryCount >= CUSTOM_GAME_RETRY_LIMIT) {
              terminateWorker();
              setIsGenerating(false);
              setRetryCount(0);
              setError(copy.custom.generationError);
              return;
            }

            setRetryCount(message.retryCount);

            // Trigger next attempt explicitly
            worker.postMessage({
              type: "generate",
              config,
              retryCount: message.retryCount,
            });
            return;
          }

          if (message.type === "success") {
            terminateWorker();
            setIsGenerating(false);

            // Persist the specific attempt that worked for instant regeneration later
            const finalAttempt = message.game.customConfig?.attempt ?? 0;
            const finalGame: GameState = {
              ...message.game,
              customConfig: {
                ...config,
                attempt: finalAttempt,
              },
            };

            setRetryCount(finalAttempt);
            saveGameState(finalGame);
            setActiveConfig(finalGame.customConfig ?? config);
            setGameState(finalGame);
            setDraft(finalGame.customConfig ?? config);
            syncCustomUrl(finalGame.customConfig ?? config, finalGame.customConfig?.attempt ?? 0);
            return;
          }

          if (message.type === "failure") {
            terminateWorker();
            setIsGenerating(false);
            setRetryCount(0);
            setError(copy.custom.generationError);
            return;
          }
        };

        worker.onerror = () => {
          terminateWorker();
          setIsGenerating(false);
          setRetryCount(0);
          setError(copy.custom.generationError);
        };

        worker.postMessage({
          type: "generate",
          config,
          retryCount: startRetryCount,
        });
      } catch {
        terminateWorker();
        setIsGenerating(false);
        setRetryCount(startRetryCount);
        setError(copy.custom.generationError);
      }
    },
    [copy.custom.generationError, syncCustomUrl, terminateWorker],
  );

  const handleSubmit = useCallback(() => {
    const normalized: CustomGameConfig = {
      givenCount: Number(draft.givenCount),
      inventoryCount: Number(draft.inventoryCount),
      sizeLimit: Number(draft.sizeLimit),
      seed: normalizeSeed(String(draft.seed)),
      limitSolutionSize: Boolean(draft.limitSolutionSize),
    };

    const validationError = isValidCustomConfig(normalized, copy.custom.validation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setDraft(normalized);
    startGeneration(normalized, 0);
  }, [draft, copy.custom.validation, startGeneration]);

  const handleBackToMenu = useCallback(() => {
    terminateWorker();
    saveGameState(null);
    location.route("/");
  }, [location, terminateWorker]);

  const handleCancelGeneration = useCallback(() => {
    terminateWorker();
    setIsGenerating(false);
    setRetryCount(0);
  }, [terminateWorker]);

  const handleCreateNewGame = useCallback(() => {
    if (!activeConfig) throw new Error("No active config");
    for (let i = 0; i < 100; i++) {
      const nextGame = generateCustomGame(activeConfig, i);
      if (nextGame) return nextGame;
    }
    throw new Error(copy.custom.couldNotRegenerate);
  }, [activeConfig, copy.custom.couldNotRegenerate]);

  const handleStateChange = useCallback((state: GameState) => {
    saveGameState(state);
    setGameState(state);
  }, []);

  useEffect(() => {
    if (gameState?.customConfig) {
      syncCustomUrl(gameState.customConfig, gameState.customConfig.attempt ?? 0);
    }
  }, [gameState, syncCustomUrl]);

  const activeGame = gameState ?? null;
  useLayoutEffect(() => {
    if (parsedConfig === null || !hasRetryCountInUrl || gameState !== null) return;
    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    startGeneration(parsedConfig, parsedRetryCount);
  }, [parsedConfig, parsedRetryCount, gameState, hasRetryCountInUrl]);

  if (activeGame && activeConfig) {
    return (
      <Game
        difficulty="Custom"
        stage={1}
        maxStage={1}
        initialState={activeGame}
        createNewGame={handleCreateNewGame}
        showNextLevelButton={false}
        onWin={() => {}}
        onBack={handleBackToMenu}
        onStageChange={() => {}}
        onStateChange={handleStateChange}
      />
    );
  }

  if (isGenerating) {
    return <CustomGameLoading retryCount={retryCount} onCancel={handleCancelGeneration} />;
  }

  return (
    <CustomGameSetup
      draft={draft}
      error={error}
      onBackToMenu={handleBackToMenu}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
    />
  );
}
