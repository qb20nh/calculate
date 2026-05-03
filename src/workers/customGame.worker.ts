/// <reference lib="webworker" />

import {
  CUSTOM_GAME_RETRY_LIMIT,
  type CustomGameGenerationFailure,
  type CustomGameGenerationProgress,
  type CustomGameGenerationRequest,
  type CustomGameGenerationSuccess,
  findCustomGameAttemptRange,
  isCustomGameGenerationRequest,
} from "@/services/customGameGeneration";

const workerGlobal = self as DedicatedWorkerGlobalScope;

workerGlobal.addEventListener("message", (event: MessageEvent<CustomGameGenerationRequest>) => {
  if (event.origin !== "" && event.origin !== workerGlobal.location.origin) return;
  if (!isCustomGameGenerationRequest(event.data)) return;

  const { config, retryCount } = event.data;
  try {
    const game = findCustomGameAttemptRange(config, retryCount, retryCount + 1);
    if (game) {
      const successMessage: CustomGameGenerationSuccess = {
        type: "success",
        game,
      };
      workerGlobal.postMessage(successMessage);
    } else {
      const progressMessage: CustomGameGenerationProgress = {
        type: "progress",
        retryCount: retryCount + 1,
        totalRetries: CUSTOM_GAME_RETRY_LIMIT,
      };
      workerGlobal.postMessage(progressMessage);
    }
  } catch {
    const failureMessage: CustomGameGenerationFailure = {
      type: "failure",
      reason:
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    };
    workerGlobal.postMessage(failureMessage);
  }
});
