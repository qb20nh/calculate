import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { match } from "ts-pattern";
import { addBasePath, toCustomGamePath } from "@/routes/routeUtils";
import {
  CUSTOM_GAME_RETRY_LIMIT,
  type CustomGameGenerationMessage,
  type CustomGameWorkerHandle,
  createCustomGameWorker,
} from "@/services/customGameGeneration";
import type { CustomGameConfig, GameState } from "@/services/storage";
import { saveGameState } from "@/services/storage";

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

  const syncCustomUrl = useCallback((config: CustomGameConfig, nextRetryCount: number) => {
    if (typeof window === "undefined") return;

    const nextPath = addBasePath(toCustomGamePath(config, nextRetryCount));
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

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
      setError(null);
      setIsGenerating(true);
      setRetryCount(startRetryCount);

      try {
        const worker = createCustomGameWorker();
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<CustomGameGenerationMessage>) => {
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
              terminateWorker();
              setIsGenerating(false);

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
              syncCustomUrl(finalGame.customConfig ?? config, finalAttempt);
              onSuccess(finalGame);
            })
            .with({ type: "failure" }, () => {
              failGeneration();
            })
            .exhaustive();
        };

        worker.onerror = () => failGeneration();

        worker.postMessage({
          type: "generate",
          config,
          retryCount: startRetryCount,
        });
      } catch {
        failGeneration(startRetryCount);
      }
    },
    [failGeneration, onSuccess, syncCustomUrl, terminateWorker],
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
