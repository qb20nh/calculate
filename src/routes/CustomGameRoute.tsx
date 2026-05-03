import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso/router";
import { Game } from "@/components/Game";
import { useAppSettings } from "@/lib/appSettings";
import { useGamePersistence } from "@/lib/gamePersistence";
import { CustomGameLoading } from "@/routes/custom/CustomGameLoading";
import { CustomGameSetup } from "@/routes/custom/CustomGameSetup";
import { useCustomGameGeneration } from "@/routes/custom/useCustomGameGeneration";
import { buildCustomConfigFromDraft } from "@/routes/customGameForm";
import { resolveCustomGameSession } from "@/routes/customGameSession";
import { validateCustomGameConfig } from "@/services/customGameConfig";
import { findCustomGameAttemptRange } from "@/services/customGameGeneration";
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
  const savedState = persistence.activeState;
  const session = useMemo(
    () =>
      resolveCustomGameSession({
        isHydrated: persistence.isHydrated,
        locationUrl: location.url,
        savedState,
      }),
    [location.url, persistence.isHydrated, savedState],
  );

  const [draft, setDraft] = useState<CustomGameConfig>(
    session.parsedConfig ?? DEFAULT_CUSTOM_CONFIG,
  );
  const [activeConfig, setActiveConfig] = useState<CustomGameConfig | null>(
    () => session.parsedConfig,
  );
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
    initialError: session.invalidUrl ? copy.custom.invalidUrl : null,
    initialIsGenerating:
      persistence.isHydrated &&
      gameState === null &&
      session.parsedConfig !== null &&
      session.hasRetryCountInUrl,
    initialRetryCount: session.parsedRetryCount,
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
    const nextGame = findCustomGameAttemptRange(activeConfig, 0, 100);
    if (nextGame) return nextGame;
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
    if (session.resumeSavedGame) {
      setActiveConfig(session.resumeSavedGame.customConfig ?? session.parsedConfig);
      setGameState(session.resumeSavedGame);
      return;
    }
    if (session.parsedConfig === null || !session.hasRetryCountInUrl) return;

    const generatedGame = findCustomGameAttemptRange(
      session.parsedConfig,
      session.parsedRetryCount,
      session.parsedRetryCount + 1,
    );
    if (generatedGame) {
      setActiveConfig(generatedGame.customConfig ?? session.parsedConfig);
      setGameState(generatedGame);
      persistence.saveActiveState(generatedGame);
      return;
    }

    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    generation.startGeneration(session.parsedConfig, session.parsedRetryCount);
  }, [persistence, session, gameState, generation]);

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
