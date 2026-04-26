import type { CustomGameConfig, GameState } from "@/services/storage";

export const CUSTOM_GAME_RETRY_LIMIT = 1000;

export type CustomGameGenerationRequest = {
  type: "generate";
  config: CustomGameConfig;
};

type CustomGameGenerationProgress = {
  type: "progress";
  retryCount: number;
  totalRetries: number;
};

type CustomGameGenerationSuccess = {
  type: "success";
  game: GameState;
};

type CustomGameGenerationFailure = {
  type: "failure";
  reason: string;
};

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
