import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_GAME_RETRY_LIMIT, createCustomGameWorker } from "@/services/customGameGeneration";

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
    expect(CUSTOM_GAME_RETRY_LIMIT).toBe(1000);
  });
});
