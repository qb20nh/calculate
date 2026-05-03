import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import { useGamePersistence } from "@/lib/gamePersistence";
import { CustomGameLoading } from "@/routes/custom/CustomGameLoading";
import { CustomGameSetup } from "@/routes/custom/CustomGameSetup";
import { useCustomGameGeneration } from "@/routes/custom/useCustomGameGeneration";
import { buildCustomConfigFromDraft } from "@/routes/customGameForm";
import { sameCustomConfig } from "@/routes/customGameHelpers";
import { parseCustomGameConfig, parseCustomGameRetryCount } from "@/routes/routeUtils";
import { generateCustomGame } from "@/services/board";
import { validateCustomGameConfig } from "@/services/customGameConfig";
import type { CustomGameConfig, GameState } from "@/services/storage";

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
  const persistence = useGamePersistence();
  const searchParams = useMemo(
    () => new URL(location.url, "http://localhost").searchParams,
    [location.url],
  );
  const parsedConfig = useMemo(() => parseCustomGameConfig(searchParams), [searchParams]);
  const parsedRetryCount = useMemo(() => parseCustomGameRetryCount(searchParams), [searchParams]);
  const hasRetryCountInUrl = useMemo(() => searchParams.has("retryCount"), [searchParams]);

  const savedState = persistence.activeState;
  const savedCustomConfig =
    persistence.isHydrated && savedState?.difficulty === "Custom" ? savedState.customConfig : null;

  const resumeSavedGame = useMemo(() => {
    if (!persistence.isHydrated) return null;
    if (!parsedConfig) return null;
    return savedState && sameCustomConfig(savedCustomConfig, parsedConfig, hasRetryCountInUrl)
      ? savedState
      : null;
  }, [persistence.isHydrated, savedState, savedCustomConfig, parsedConfig, hasRetryCountInUrl]);

  const [draft, setDraft] = useState<CustomGameConfig>(parsedConfig ?? DEFAULT_CUSTOM_CONFIG);
  const [activeConfig, setActiveConfig] = useState<CustomGameConfig | null>(() => parsedConfig);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleGenerationSuccess = useCallback(
    (finalGame: GameState) => {
      setActiveConfig(finalGame.customConfig ?? null);
      setGameState(finalGame);
      persistence.saveActiveState(finalGame);
      if (finalGame.customConfig) {
        setDraft(finalGame.customConfig);
      }
    },
    [persistence],
  );

  const generation = useCustomGameGeneration({
    initialError:
      parsedConfig === null && searchParams.toString().length > 0 ? copy.custom.invalidUrl : null,
    initialIsGenerating:
      persistence.isHydrated && gameState === null && parsedConfig !== null && hasRetryCountInUrl,
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

  const handleStateChange = useCallback(
    (state: GameState) => {
      persistence.saveActiveState(state);
      setGameState(state);
    },
    [persistence],
  );

  useEffect(() => {
    if (gameState?.customConfig) {
      generation.syncCustomUrl(gameState.customConfig, gameState.customConfig.attempt ?? 0);
    }
  }, [gameState, generation]);

  useLayoutEffect(() => {
    if (!persistence.isHydrated || gameState !== null) return;
    if (resumeSavedGame) {
      setActiveConfig(resumeSavedGame.customConfig ?? parsedConfig);
      setGameState(resumeSavedGame);
      return;
    }
    if (parsedConfig === null || !hasRetryCountInUrl) return;

    const generatedGame = generateCustomGame(parsedConfig, parsedRetryCount);
    if (generatedGame) {
      setActiveConfig(generatedGame.customConfig ?? parsedConfig);
      setGameState(generatedGame);
      persistence.saveActiveState(generatedGame);
      return;
    }

    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    generation.startGeneration(parsedConfig, parsedRetryCount);
  }, [
    persistence,
    resumeSavedGame,
    parsedConfig,
    parsedRetryCount,
    gameState,
    hasRetryCountInUrl,
    generation,
  ]);

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
