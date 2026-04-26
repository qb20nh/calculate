import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
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

const isValidCustomConfig = (config: CustomGameConfig) => {
  if (!Number.isSafeInteger(config.givenCount) || config.givenCount <= 0) {
    return "Given count must be a positive whole number.";
  }
  if (!Number.isSafeInteger(config.inventoryCount) || config.inventoryCount <= 0) {
    return "Inventory tile count must be a positive whole number.";
  }
  if (!Number.isSafeInteger(config.sizeLimit) || config.sizeLimit <= 0) {
    return "Board size limit must be a positive whole number.";
  }
  if (typeof config.limitSolutionSize !== "boolean") {
    return "Custom option settings are invalid.";
  }
  if (config.givenCount + config.inventoryCount < 5) {
    return "Need at least 5 total tiles.";
  }
  if (config.givenCount + config.inventoryCount > config.sizeLimit * config.sizeLimit) {
    return "Tile count exceeds board size limit.";
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
    <label htmlFor={htmlFor} className="text-sm font-bold text-slate-600">
      {label}
    </label>
    {children}
  </div>
);

const CustomGameSetup = ({
  draft,
  error,
  onBackToMenu,
  onDraftChange,
  onSubmit,
}: {
  draft: CustomGameConfig;
  error: string | null;
  onBackToMenu: () => void;
  onDraftChange: (next: CustomGameConfig) => void;
  onSubmit: () => void;
}) => (
  <div className="h-dvh w-full flex items-center justify-center bg-slate-50 p-4">
    <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-xl md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 md:text-4xl">
            Custom Game
          </h1>
          <p className="mt-2 font-medium text-slate-500">
            Pick exact counts, size limit, and seed. URL will keep setup.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Field label="Given count" htmlFor="custom-given-count">
          <input
            id="custom-given-count"
            type="number"
            min="1"
            step="1"
            value={draft.givenCount}
            onInput={(e) =>
              onDraftChange({
                ...draft,
                givenCount: Number((e.currentTarget as HTMLInputElement).value),
              })
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-slate-400"
          />
        </Field>

        <Field label="Inventory tile count" htmlFor="custom-inventory-count">
          <input
            id="custom-inventory-count"
            type="number"
            min="1"
            step="1"
            value={draft.inventoryCount}
            onInput={(e) =>
              onDraftChange({
                ...draft,
                inventoryCount: Number((e.currentTarget as HTMLInputElement).value),
              })
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-slate-400"
          />
        </Field>

        <Field label="Board size limit" htmlFor="custom-size-limit">
          <input
            id="custom-size-limit"
            type="number"
            min="1"
            step="1"
            value={draft.sizeLimit}
            onInput={(e) =>
              onDraftChange({
                ...draft,
                sizeLimit: Number((e.currentTarget as HTMLInputElement).value),
              })
            }
            className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-slate-400"
          />
        </Field>

        <Field label="Seed" htmlFor="custom-seed">
          <input
            id="custom-seed"
            type="text"
            value={draft.seed}
            onInput={(e) =>
              onDraftChange({
                ...draft,
                seed: (e.currentTarget as HTMLInputElement).value,
              })
            }
            placeholder="blank or 0 = random"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none focus:border-slate-400"
          />
        </Field>

        <div className="rounded-2xl border border-slate-200 p-4">
          <label className="flex gap-3">
            <input
              id="custom-limit-solution-size"
              type="checkbox"
              checked={draft.limitSolutionSize}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  limitSolutionSize: (e.currentTarget as HTMLInputElement).checked,
                })
              }
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-700"
            />
            <span className="text-sm font-bold text-slate-700">
              Limit submitted solution size too
            </span>
          </label>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Reject a solved board if its final width or height exceeds the configured limit.
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
          className="rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-600 transition active:scale-95"
        >
          Back to menu
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-2xl theme-primary-bg px-5 py-4 font-bold text-white shadow-xl transition active:scale-95"
        >
          Start custom game
        </button>
      </div>
    </div>
  </div>
);

const CustomGameLoading = ({
  retryCount,
  onCancel,
}: {
  retryCount: number;
  onCancel: () => void;
}) => (
  <div className="h-dvh w-full flex items-center justify-center bg-slate-50 p-4">
    <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-xl md:p-8">
      <div className="flex items-center gap-4">
        <div className="size-14 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        <div className="grid gap-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-800">
            Generating custom game
          </h1>
          <p className="font-medium text-slate-500">
            Retry {retryCount} / {CUSTOM_GAME_RETRY_LIMIT}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
        Worker retries the same seeded generator until it finds a valid board or hits the limit.
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-6 w-full rounded-2xl border border-slate-200 px-5 py-4 font-bold text-slate-600 transition active:scale-95"
      >
        Cancel
      </button>
    </div>
  </div>
);

export default function CustomGameRoute() {
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
    parsedConfig === null && searchParams.toString().length > 0
      ? "Invalid custom settings in URL."
      : null,
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
          setError(message.reason);
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
        setError(
          "Could not generate a puzzle with those settings. Try a larger board or different seed.",
        );
      };

      worker.postMessage({
        type: "generate",
        config,
      });
    } catch {
      terminateWorker();
      setIsGenerating(false);
      setRetryCount(0);
      setError(
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
      );
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

    const validationError = isValidCustomConfig(normalized);
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
            throw new Error("Could not regenerate custom puzzle.");
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
