import { assertType, expectTypeOf } from "vitest";
import { toGamePath } from "@/routes/routeUtils";
import type {
  CustomGameGenerationMessage,
  CustomGameGenerationRequest,
  CustomGameWorkerHandle,
} from "@/services/customGameGeneration";
import type { Difficulty, GameMode, Progress, ProgressMode } from "@/services/storage";

expectTypeOf<GameMode>().toEqualTypeOf<Difficulty | "Custom" | "Crossing">();
expectTypeOf<ProgressMode>().toEqualTypeOf<Difficulty | "Crossing">();
expectTypeOf<CustomGameGenerationMessage["type"]>().toEqualTypeOf<
  "progress" | "success" | "failure"
>();

declare const progress: Progress;

expectTypeOf(progress.Easy).toEqualTypeOf<Readonly<{ current: number; max: number }>>();
expectTypeOf(progress.Crossing).toEqualTypeOf<
  Readonly<{ current: number; max: number }> | undefined
>();

assertType<string>(toGamePath("Easy", 1));
assertType<string>(toGamePath("Crossing", 1));

// @ts-expect-error Custom games use toCustomGamePath because they need config.
toGamePath("Custom", 1);

const request: CustomGameGenerationRequest = {
  type: "generate",
  config: {
    givenCount: 6,
    inventoryCount: 10,
    sizeLimit: 10,
    seed: "123",
    limitSolutionSize: false,
  },
  retryCount: 0,
};

declare const worker: CustomGameWorkerHandle;

worker.postMessage(request);

// @ts-expect-error Worker accepts generation requests, not result messages.
worker.postMessage({ type: "progress", retryCount: 1, totalRetries: 2 });

// @ts-expect-error Generation request data is read-only at service boundaries.
request.retryCount = 1;

// @ts-expect-error Custom-game config data is read-only at service boundaries.
request.config.seed = "next";
