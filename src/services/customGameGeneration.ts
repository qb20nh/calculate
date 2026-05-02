import { CUSTOM_GAME_LIMITS } from "@/services/customGameConfig";
import type { CustomGameConfig, GameState } from "@/services/storage";

export const CUSTOM_GAME_RETRY_LIMIT = CUSTOM_GAME_LIMITS.maxRetryCount + 1;

export type CustomGameGenerationRequest = Readonly<{
  type: "generate";
  config: CustomGameConfig;
  retryCount: number;
}>;

export type CustomGameGenerationProgress = Readonly<{
  type: "progress";
  retryCount: number;
  totalRetries: number;
}>;

export type CustomGameGenerationSuccess = Readonly<{
  type: "success";
  game: GameState;
}>;

export type CustomGameGenerationFailure = Readonly<{
  type: "failure";
  reason: string;
}>;

export type CustomGameGenerationMessage =
  | CustomGameGenerationProgress
  | CustomGameGenerationSuccess
  | CustomGameGenerationFailure;

export type CustomGameWorkerHandle = {
  postMessage: (message: CustomGameGenerationRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<CustomGameGenerationMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export const createCustomGameWorker = (): CustomGameWorkerHandle =>
  new Worker(new URL("../workers/customGame.worker.ts", import.meta.url), {
    type: "module",
  }) as CustomGameWorkerHandle;
