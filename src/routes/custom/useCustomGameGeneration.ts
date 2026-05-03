import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { match } from "ts-pattern";
import { addBasePath, toCustomGamePath } from "@/routes/routeUtils";
import { generateCustomGame } from "@/services/board";
import {
  CUSTOM_GAME_RETRY_LIMIT,
  type CustomGameGenerationMessage,
  type CustomGameWorkerHandle,
  createCustomGameWorker,
  isCustomGameGenerationMessage,
} from "@/services/customGameGeneration";
import type { CustomGameConfig, GameState } from "@/services/storage";

export function useCustomGameGeneration({
  initialError,
  initialIsGenerating,
  initialRetryCount,
  generationError,
  onSuccess,
}: {
  initialError: string | null;
  initialIsGenerating: boolean;
  initialRetryCount: number;
  generationError: string;
  onSuccess: (game: GameState) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(initialIsGenerating);
  const [retryCount, setRetryCount] = useState(initialRetryCount);
  const [error, setError] = useState<string | null>(initialError);
  const workerRef = useRef<CustomGameWorkerHandle | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runTokenRef = useRef(0);

  const syncCustomUrl = useCallback((config: CustomGameConfig, nextRetryCount: number) => {
    if (typeof window === "undefined") return;

    const nextPath = addBasePath(toCustomGamePath(config, nextRetryCount));
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const terminateWorker = useCallback(() => {
    runTokenRef.current++;
    clearFallbackTimer();
    workerRef.current?.terminate();
    workerRef.current = null;
  }, [clearFallbackTimer]);

  useEffect(() => () => terminateWorker(), [terminateWorker]);

  const failGeneration = useCallback(
    (nextRetryCount = 0) => {
      terminateWorker();
      setIsGenerating(false);
      setRetryCount(nextRetryCount);
      setError(generationError);
    },
    [generationError, terminateWorker],
  );

  const startGeneration = useCallback(
    (config: CustomGameConfig, startRetryCount: number) => {
      terminateWorker();
      const runToken = runTokenRef.current;
      setError(null);
      setIsGenerating(true);
      setRetryCount(startRetryCount);

      const succeedGeneration = (game: GameState) => {
        if (runTokenRef.current !== runToken) return;
        terminateWorker();
        setIsGenerating(false);

        const finalAttempt = game.customConfig?.attempt ?? 0;
        const finalGame: GameState = {
          ...game,
          customConfig: {
            ...config,
            attempt: finalAttempt,
          },
        };

        setRetryCount(finalAttempt);
        syncCustomUrl(finalGame.customConfig ?? config, finalAttempt);
        onSuccess(finalGame);
      };

      const startFallbackGeneration = (fallbackStartRetryCount: number) => {
        workerRef.current?.terminate();
        workerRef.current = null;
        clearFallbackTimer();

        const runFallbackBatch = (batchStartRetryCount: number) => {
          if (runTokenRef.current !== runToken) return;

          const batchEndRetryCount = Math.min(batchStartRetryCount + 50, CUSTOM_GAME_RETRY_LIMIT);
          for (
            let nextRetryCount = batchStartRetryCount;
            nextRetryCount < batchEndRetryCount;
            nextRetryCount++
          ) {
            const game = generateCustomGame(config, nextRetryCount);
            if (game) {
              succeedGeneration(game);
              return;
            }
          }

          if (batchEndRetryCount >= CUSTOM_GAME_RETRY_LIMIT) {
            failGeneration();
            return;
          }

          setRetryCount(batchEndRetryCount);
          fallbackTimerRef.current = setTimeout(() => {
            runFallbackBatch(batchEndRetryCount);
          }, 0);
        };

        runFallbackBatch(fallbackStartRetryCount);
      };

      try {
        const worker = createCustomGameWorker();
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<CustomGameGenerationMessage>) => {
          if (!isCustomGameGenerationMessage(event.data)) {
            startFallbackGeneration(startRetryCount);
            return;
          }

          match(event.data)
            .with({ type: "progress" }, (message) => {
              if (message.retryCount >= CUSTOM_GAME_RETRY_LIMIT) {
                failGeneration();
                return;
              }

              setRetryCount(message.retryCount);
              worker.postMessage({
                type: "generate",
                config,
                retryCount: message.retryCount,
              });
            })
            .with({ type: "success" }, (message) => {
              succeedGeneration(message.game);
            })
            .with({ type: "failure" }, () => {
              failGeneration();
            })
            .exhaustive();
        };

        worker.onerror = () => startFallbackGeneration(startRetryCount);

        worker.postMessage({
          type: "generate",
          config,
          retryCount: startRetryCount,
        });
      } catch {
        startFallbackGeneration(startRetryCount);
      }
    },
    [clearFallbackTimer, failGeneration, onSuccess, syncCustomUrl, terminateWorker],
  );

  const cancelGeneration = useCallback(() => {
    terminateWorker();
    setIsGenerating(false);
    setRetryCount(0);
  }, [terminateWorker]);

  return {
    error,
    isGenerating,
    retryCount,
    setError,
    startGeneration,
    cancelGeneration,
    syncCustomUrl,
    terminateWorker,
  };
}
