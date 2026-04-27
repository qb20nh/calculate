import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import { parseCustomGameConfig, toCustomGamePath } from "@/routes/routeUtils";
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
  (left.limitSolutionSize ?? false) === right.limitSolutionSize;

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
            className="rounded-2xl border theme-border px-5 py-4 font-bold theme-muted-text transition active:scale-95"
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
  const { copy } = useAppSettings();
  useAppReadinessSignal(false, "custom-loading");

  return (
    <div className="theme-page-bg h-dvh w-full flex items-center justify-center p-4">
      <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4">
          <div className="size-14 animate-spin rounded-full border-4 theme-spinner" />
          <div className="grid gap-1">
            <h1 className="text-2xl font-black tracking-tight">{copy.custom.loadingTitle}</h1>
            <p className="font-medium theme-muted-text">
              {copy.custom.retryLabel(retryCount, CUSTOM_GAME_RETRY_LIMIT)}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl theme-panel-strong px-4 py-3 text-sm font-medium">
          {copy.custom.loadingHint}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-6 w-full rounded-2xl border theme-border px-5 py-4 font-bold theme-muted-text transition active:scale-95"
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
  const savedState = useMemo(() => loadGameState(), []);
  const savedCustomConfig = savedState?.difficulty === "Custom" ? savedState.customConfig : null;

  const [draft, setDraft] = useState<CustomGameConfig>(parsedConfig ?? DEFAULT_CUSTOM_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CustomGameConfig | null>(
    parsedConfig && sameCustomConfig(savedCustomConfig, parsedConfig) ? parsedConfig : null,
  );
  const [gameState, setGameState] = useState<GameState | null>(
    parsedConfig && sameCustomConfig(savedCustomConfig, parsedConfig) ? savedState : null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(
    parsedConfig === null && searchParams.toString().length > 0 ? copy.custom.invalidUrl : null,
  );

  const workerRef = useRef<CustomGameWorkerHandle | null>(null);

  const terminateWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  useEffect(() => () => terminateWorker(), []);

  const startGeneration = (config: CustomGameConfig) => {
    const nextPath = toCustomGamePath(config);
    if (location.url !== nextPath) {
      location.route(nextPath, true);
    }

    terminateWorker();
    setError(null);
    setIsGenerating(true);
    setRetryCount(0);

    try {
      const worker = createCustomGameWorker();
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<CustomGameGenerationMessage>) => {
        const message = event.data;
        if (message.type === "progress") {
          setRetryCount(message.retryCount);
          return;
        }

        terminateWorker();
        setIsGenerating(false);
        setRetryCount(0);

        if (message.type === "failure") {
          setError(copy.custom.generationError);
          return;
        }

        saveGameState(message.game);
        setActiveConfig(config);
        setGameState(message.game);
        setDraft(config);
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
      });
    } catch {
      terminateWorker();
      setIsGenerating(false);
      setRetryCount(0);
      setError(copy.custom.generationError);
    }
  };

  const handleSubmit = () => {
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
    startGeneration(normalized);
  };

  const handleBackToMenu = () => {
    terminateWorker();
    saveGameState(null);
    location.route("/");
  };

  const handleCancelGeneration = () => {
    terminateWorker();
    setIsGenerating(false);
    setRetryCount(0);
  };

  const activeGame = gameState ?? null;

  if (activeGame && activeConfig) {
    return (
      <Game
        difficulty="Custom"
        stage={1}
        maxStage={1}
        initialState={activeGame}
        createNewGame={() => {
          const nextGame = generateCustomGame(activeConfig);
          if (!nextGame) {
            throw new Error(copy.custom.couldNotRegenerate);
          }
          return nextGame;
        }}
        showNextLevelButton={false}
        onWin={() => {}}
        onBack={handleBackToMenu}
        onStageChange={() => {}}
        onStateChange={(state) => {
          saveGameState(state);
          setGameState(state);
        }}
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
