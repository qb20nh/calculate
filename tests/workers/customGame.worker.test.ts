import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomGameConfig } from "@/services/storage";

const mockGenerateCustomGameAttempt = vi.fn();
let mockHandler:
  | ((
      event: MessageEvent<{ type: string; config?: CustomGameConfig; retryCount?: number }>,
    ) => void)
  | null = null;
const mockPostMessage = vi.fn();

vi.mock("@/services/board/generation", () => ({
  generateCustomGameAttempt: (...args: unknown[]) => mockGenerateCustomGameAttempt(...args),
}));

describe("custom game worker", () => {
  beforeEach(() => {
    mockGenerateCustomGameAttempt.mockReset();
    mockPostMessage.mockReset();
    mockHandler = null;
    vi.unstubAllGlobals();
    vi.stubGlobal("self", {
      addEventListener: vi.fn((eventName: string, listener: typeof mockHandler) => {
        if (eventName === "message") {
          mockHandler = listener;
        }
      }),
      location: {
        origin: "https://example.test",
      },
      postMessage: mockPostMessage,
    });
    vi.resetModules();
  });

  it("should ignore non-generate messages", async () => {
    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "https://example.test",
      data: { type: "noop" },
    } as unknown as MessageEvent<{ type: "noop" }>);

    expect(mockGenerateCustomGameAttempt).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("should ignore invalid generate requests", async () => {
    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        retryCount: 0,
      },
    } as unknown as MessageEvent<{ type: "generate"; retryCount: number }>);

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        config: {
          givenCount: 6,
          inventoryCount: 10,
          sizeLimit: 21,
          seed: "123",
          limitSolutionSize: false,
        },
        retryCount: 0,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        config: {
          givenCount: 6,
          inventoryCount: 10,
          sizeLimit: 10,
          seed: "123",
          limitSolutionSize: false,
        },
        retryCount: 10000,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    expect(mockGenerateCustomGameAttempt).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("should post progress and success for a generated game", async () => {
    const game = {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Custom",
      stage: 1,
      customConfig: {
        givenCount: 6,
        inventoryCount: 10,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: false,
      },
    };
    mockGenerateCustomGameAttempt.mockReturnValueOnce(game);

    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        config: game.customConfig,
        retryCount: 0,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    expect(mockGenerateCustomGameAttempt).toHaveBeenCalledWith(game.customConfig, 0);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "success",
      game,
    });
  });

  it("should replay a specific retry once", async () => {
    const game = {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Custom",
      stage: 1,
      customConfig: {
        givenCount: 6,
        inventoryCount: 10,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: false,
      },
    };
    mockGenerateCustomGameAttempt.mockReturnValueOnce(game);

    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "",
      data: {
        type: "generate",
        config: game.customConfig,
        retryCount: 4,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    expect(mockGenerateCustomGameAttempt).toHaveBeenCalledWith(game.customConfig, 4);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "success",
      game,
    });
  });

  it("should post failure after exhausting retries", async () => {
    const config: CustomGameConfig = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: true,
    };
    mockGenerateCustomGameAttempt.mockReturnValue(null);

    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        config,
        retryCount: 0,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    expect(mockGenerateCustomGameAttempt).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "progress",
        retryCount: 1,
        totalRetries: 10000,
      }),
    );
  });

  it("should post failure when generation throws", async () => {
    const config: CustomGameConfig = {
      givenCount: 6,
      inventoryCount: 10,
      sizeLimit: 10,
      seed: "123",
      limitSolutionSize: false,
    };
    mockGenerateCustomGameAttempt.mockImplementation(() => {
      throw new Error("boom");
    });

    await import("@/workers/customGame.worker");

    mockHandler?.({
      origin: "https://example.test",
      data: {
        type: "generate",
        config,
        retryCount: 0,
      },
    } as MessageEvent<{ type: "generate"; config: CustomGameConfig; retryCount: number }>);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "failure",
      reason:
        "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    });
  });
});
