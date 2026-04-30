import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import { CustomGameLoading } from "@/routes/custom/CustomGameLoading";
import { CustomGameSetup } from "@/routes/custom/CustomGameSetup";
import { useCustomGameGeneration } from "@/routes/custom/useCustomGameGeneration";
import { buildCustomConfigFromDraft } from "@/routes/customGameForm";
import { sameCustomConfig } from "@/routes/customGameHelpers";
import { parseCustomGameConfig, parseCustomGameRetryCount } from "@/routes/routeUtils";
import { generateCustomGame } from "@/services/board";
import { validateCustomGameConfig } from "@/services/customGameConfig";
import type { CustomGameConfig, GameState } from "@/services/storage";
import { loadGameState, saveGameState } from "@/services/storage";

const DEFAULT_CUSTOM_CONFIG: CustomGameConfig = {
  givenCount: 8,
  inventoryCount: 12,
  sizeLimit: 10,
  seed: "",
  limitSolutionSize: false,
};

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

  const resumeSavedGame = useMemo(() => {
    if (!parsedConfig) return null;
    return savedState && sameCustomConfig(savedCustomConfig, parsedConfig, hasRetryCountInUrl)
      ? savedState
      : null;
  }, [savedState, savedCustomConfig, parsedConfig, hasRetryCountInUrl]);

  const [draft, setDraft] = useState<CustomGameConfig>(parsedConfig ?? DEFAULT_CUSTOM_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CustomGameConfig | null>(() => parsedConfig);
  const [gameState, setGameState] = useState<GameState | null>(() => {
    if (resumeSavedGame) return resumeSavedGame;
    if (parsedConfig && hasRetryCountInUrl) {
      return generateCustomGame(parsedConfig, parsedRetryCount);
    }
    return null;
  });

  const handleGenerationSuccess = useCallback((finalGame: GameState) => {
    setActiveConfig(finalGame.customConfig ?? null);
    setGameState(finalGame);
    if (finalGame.customConfig) {
      setDraft(finalGame.customConfig);
    }
  }, []);

  const generation = useCustomGameGeneration({
    initialError:
      parsedConfig === null && searchParams.toString().length > 0 ? copy.custom.invalidUrl : null,
    initialIsGenerating: gameState === null && parsedConfig !== null && hasRetryCountInUrl,
    initialRetryCount: parsedRetryCount,
    generationError: copy.custom.generationError,
    onSuccess: handleGenerationSuccess,
  });

  const resumeStartedRef = useRef(false);

  const handleSubmit = useCallback(() => {
    const normalized: CustomGameConfig = buildCustomConfigFromDraft(draft);

    const validationError = validateCustomGameConfig(normalized);
    if (validationError) {
      generation.setError(copy.custom.validation[validationError]);
      return;
    }

    setDraft(normalized);
    generation.startGeneration(normalized, 0);
  }, [draft, copy.custom.validation, generation]);

  const handleBackToMenu = useCallback(() => {
    generation.terminateWorker();
    saveGameState(null);
    location.route("/");
  }, [generation, location]);

  const handleCreateNewGame = useCallback(() => {
    if (!activeConfig) throw new Error("No active config");
    for (let attempt = 0; attempt < 100; attempt++) {
      const nextGame = generateCustomGame(activeConfig, attempt);
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
      generation.syncCustomUrl(gameState.customConfig, gameState.customConfig.attempt ?? 0);
    }
  }, [gameState, generation]);

  useLayoutEffect(() => {
    if (parsedConfig === null || !hasRetryCountInUrl || gameState !== null) return;
    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    generation.startGeneration(parsedConfig, parsedRetryCount);
  }, [parsedConfig, parsedRetryCount, gameState, hasRetryCountInUrl, generation]);

  if (gameState && activeConfig) {
    return (
      <Game
        difficulty="Custom"
        stage={1}
        maxStage={1}
        initialState={gameState}
        createNewGame={handleCreateNewGame}
        showNextLevelButton={false}
        onWin={() => {}}
        onBack={handleBackToMenu}
        onStageChange={() => {}}
        onStateChange={handleStateChange}
      />
    );
  }

  if (generation.isGenerating) {
    return (
      <CustomGameLoading
        retryCount={generation.retryCount}
        onCancel={generation.cancelGeneration}
      />
    );
  }

  return (
    <CustomGameSetup
      draft={draft}
      error={generation.error}
      onBackToMenu={handleBackToMenu}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
    />
  );
}
