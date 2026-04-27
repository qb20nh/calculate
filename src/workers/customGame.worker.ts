import { generateCustomGameAttempt } from "@/services/board";
import {
  CUSTOM_GAME_RETRY_LIMIT,
  type CustomGameGenerationMessage,
  type CustomGameGenerationRequest,
} from "@/services/customGameGeneration";

const workerGlobal = self as typeof self & {
  addEventListener: typeof self.addEventListener;
  postMessage: typeof self.postMessage;
  location: Location;
};

function isCustomGameGenerationRequest(data: unknown): data is CustomGameGenerationRequest {
  if (typeof data !== "object" || data === null) return false;
  if (!("type" in data) || data.type !== "generate") return false;
  return "config" in data;
}

workerGlobal.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== workerGlobal.location.origin) return;
  if (!isCustomGameGenerationRequest(event.data)) return;

  const { config } = event.data;
  try {
    for (let attempt = 0; attempt < CUSTOM_GAME_RETRY_LIMIT; attempt++) {
      const retryMessage: CustomGameGenerationMessage = {
        type: "progress",
        retryCount: attempt + 1,
        totalRetries: CUSTOM_GAME_RETRY_LIMIT,
      };
      workerGlobal.postMessage(retryMessage);

      const game = generateCustomGameAttempt(config, attempt);
      if (game) {
        workerGlobal.postMessage({
          type: "success",
          game,
        } satisfies CustomGameGenerationMessage);
        return;
      }
    }

    workerGlobal.postMessage({
      type: "failure",
      reason:
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    } satisfies CustomGameGenerationMessage);
  } catch {
    workerGlobal.postMessage({
      type: "failure",
      reason:
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    } satisfies CustomGameGenerationMessage);
  }
});
