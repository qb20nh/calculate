import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCustomGameAttempt } from "@/services/board";
import {
  CUSTOM_GAME_RETRY_LIMIT,
  createCustomGameWorker,
  findCustomGameAttemptRange,
} from "@/services/customGameGeneration";

describe("custom game generation service", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("should create a module worker for custom generation", () => {
    const workerArgs: Array<[URL, WorkerOptions | undefined]> = [];
    class WorkerMock {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage = null;
      onerror = null;

      constructor(url: URL, options?: WorkerOptions) {
        workerArgs.push([url, options]);
      }
    }
    vi.stubGlobal("Worker", WorkerMock as never);

    const worker = createCustomGameWorker();

    expect(worker).toBeInstanceOf(WorkerMock);
    expect(workerArgs).toHaveLength(1);
    expect(workerArgs[0]?.[0]).toEqual(expect.any(URL));
    expect(workerArgs[0]?.[1]).toEqual(expect.objectContaining({ type: "module" }));
    expect(CUSTOM_GAME_RETRY_LIMIT).toBe(10000);
  });

  it("should search a custom game retry range", () => {
    const config = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "12345",
      limitSolutionSize: false,
    };

    const game = findCustomGameAttemptRange(config, 0, 100);

    expect(game).not.toBeNull();
    if (!game) return;
    expect(game.customConfig?.attempt).toBeDefined();
    expect(game).toEqual(generateCustomGameAttempt(config, game.customConfig?.attempt ?? 0));
    expect(findCustomGameAttemptRange(config, 0, 0)).toBe(null);
  });
});
