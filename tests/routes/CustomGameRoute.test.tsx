import { fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/services/storage";

type WorkerMessage =
  | {
      type: "progress";
      retryCount: number;
      totalRetries: number;
    }
  | {
      type: "success";
      game: GameState;
    }
  | {
      type: "failure";
      reason: string;
    };

type MockWorker = {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

const mockRoute = vi.fn();
let mockLocationUrl = "/game/custom";

const mockLoadGameState = vi.fn((): GameState | null => null);
const mockSaveGameState = vi.fn();
const mockGenerateCustomGame = vi.fn();
const mockCreateCustomGameWorker = vi.fn(() => makeWorker());

const mockWorkers: MockWorker[] = [];

const makeWorker = (): MockWorker => {
  const worker: MockWorker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  };
  mockWorkers.push(worker);
  return worker;
};

vi.mock("preact-iso/router", () => ({
  useLocation: () => ({
    route: mockRoute,
    path: "/game/custom",
    url: mockLocationUrl,
  }),
}));

vi.mock("@/services/storage", () => ({
  loadGameState: () => mockLoadGameState(),
  saveGameState: (...args: unknown[]) => mockSaveGameState(...args),
}));

vi.mock("@/services/customGameGeneration", () => ({
  CUSTOM_GAME_RETRY_LIMIT: 1000,
  createCustomGameWorker: () => mockCreateCustomGameWorker(),
}));

vi.mock("@/services/board", () => ({
  generateCustomGame: (...args: unknown[]) => mockGenerateCustomGame(...args),
}));

vi.mock("@/components/Game", () => ({
  Game: ({
    createNewGame,
    initialState,
    onBack,
    onStateChange,
    showNextLevelButton,
  }: {
    createNewGame: () => unknown;
    initialState: unknown;
    onBack: () => void;
    onStateChange: (state: unknown) => void;
    showNextLevelButton: boolean;
  }) => (
    <div>
      <div>Mock Game</div>
      <div>{showNextLevelButton ? "next-visible" : "next-hidden"}</div>
      <button
        type="button"
        onClick={() => {
          onStateChange(initialState);
        }}
      >
        Save state
      </button>
      <button
        type="button"
        onClick={() => {
          onBack();
        }}
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          const next = createNewGame();
          onStateChange(next);
        }}
      >
        Regenerate
      </button>
    </div>
  ),
}));

describe("CustomGameRoute", () => {
  beforeEach(() => {
    mockLocationUrl = "/game/custom";
    mockRoute.mockReset();
    mockLoadGameState.mockReset();
    mockSaveGameState.mockReset();
    mockGenerateCustomGame.mockReset();
    mockCreateCustomGameWorker.mockReset();
    mockCreateCustomGameWorker.mockImplementation(makeWorker);
    mockWorkers.splice(0, mockWorkers.length);
    mockGenerateCustomGame.mockReturnValue({
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Custom",
      stage: 1,
      customConfig: {
        givenCount: 8,
        inventoryCount: 12,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: false,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render the setup form with back action and checkbox", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    expect(screen.getByText("Custom Game")).toBeDefined();
    expect(screen.getByText("Back to menu")).toBeDefined();
    expect(
      screen.getByRole("checkbox", { name: /Limit submitted solution size too/ }),
    ).toBeDefined();
    expect(screen.getByLabelText("Given count")).toBeDefined();
  });

  it("should route back to menu from setup", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.click(screen.getByText("Back to menu"));
    expect(mockRoute).toHaveBeenCalledWith("/");
  });

  it("should show an URL error for invalid query params", async () => {
    mockLocationUrl = "/game/custom?given=abc";
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    expect(screen.getByText("Invalid custom settings in URL.")).toBeDefined();
  });

  it("should resume a saved custom game with the limit flag", async () => {
    const savedState: GameState = {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Custom",
      stage: 1,
      customConfig: {
        givenCount: 8,
        inventoryCount: 12,
        sizeLimit: 10,
        seed: "123",
        limitSolutionSize: true,
      },
    };
    mockLocationUrl = "/game/custom?given=8&inventory=12&size=10&seed=123&limitSolutionSize=1";
    mockLoadGameState.mockReturnValue(savedState);

    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    expect(screen.getByText("Mock Game")).toBeDefined();
    expect(screen.getByText("next-hidden")).toBeDefined();
  });

  it("should resume older saved custom games without the limit flag", async () => {
    const savedState = {
      board: {},
      bank: [],
      initialBankSize: 0,
      status: "playing",
      difficulty: "Custom",
      stage: 1,
      customConfig: {
        givenCount: 8,
        inventoryCount: 12,
        sizeLimit: 10,
        seed: "123",
      },
    } as unknown as GameState;
    mockLocationUrl = "/game/custom?given=8&inventory=12&size=10&seed=123";
    mockLoadGameState.mockReturnValue(savedState);

    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    expect(screen.getByText("Mock Game")).toBeDefined();
    expect(screen.getByText("next-hidden")).toBeDefined();
  });

  it("should reject invalid custom settings on submit", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    expect(screen.getByText("Given count must be a positive whole number.")).toBeDefined();
    expect(mockCreateCustomGameWorker).not.toHaveBeenCalled();
  });

  it("should show live retry progress while generating", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "6" },
    });
    fireEvent.input(screen.getByLabelText("Inventory tile count"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Board size limit"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Seed"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    expect(mockCreateCustomGameWorker).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Retry 0 / 1000")).toBeDefined();

    const worker = mockWorkers[0];
    expect(worker).toBeDefined();
    worker?.onmessage?.({
      data: {
        type: "progress",
        retryCount: 37,
        totalRetries: 1000,
      },
    } as unknown as MessageEvent<WorkerMessage>);

    await screen.findByText("Retry 37 / 1000");

    worker?.onmessage?.({
      data: {
        type: "success",
        game: {
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
        },
      },
    } as unknown as MessageEvent<WorkerMessage>);

    await screen.findByText("Mock Game");
    expect(mockSaveGameState).toHaveBeenCalled();
    expect(mockRoute).toHaveBeenCalledWith(
      "/game/custom?given=6&inventory=10&size=10&seed=123",
      true,
    );
  });

  it("should show a worker failure reason", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "6" },
    });
    fireEvent.input(screen.getByLabelText("Inventory tile count"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Board size limit"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    const worker = mockWorkers[0];
    expect(worker).toBeDefined();
    worker?.onmessage?.({
      data: {
        type: "failure",
        reason: "No board found.",
      },
    } as unknown as MessageEvent<WorkerMessage>);

    await screen.findByText("No board found.");
    expect(screen.getByText("Custom Game")).toBeDefined();
  });

  it("should show a generic error when the worker errors", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "6" },
    });
    fireEvent.input(screen.getByLabelText("Inventory tile count"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Board size limit"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    const worker = mockWorkers[0];
    expect(worker).toBeDefined();
    worker?.onerror?.(new ErrorEvent("error"));

    await screen.findByText(
      "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    );
  });

  it("should handle a worker factory crash", async () => {
    mockCreateCustomGameWorker.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "6" },
    });
    fireEvent.input(screen.getByLabelText("Inventory tile count"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Board size limit"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    await screen.findByText(
      "Could not generate a puzzle with those settings. Try a larger board or different seed.",
    );
  });

  it("should cancel generation and terminate the worker", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Given count"), {
      target: { value: "6" },
    });
    fireEvent.input(screen.getByLabelText("Inventory tile count"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Board size limit"), {
      target: { value: "10" },
    });
    fireEvent.input(screen.getByLabelText("Seed"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    const worker = mockWorkers[0];
    expect(worker).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(worker?.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Custom Game")).toBeDefined();
  });

  it("should normalize a random seed when zero is entered", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint32Array) => {
        buffer[0] = 123456;
        return buffer;
      },
    });
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Seed"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    const worker = mockWorkers[0];
    expect(worker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "generate",
        config: expect.objectContaining({
          seed: "123456",
        }),
      }),
    );
  });

  it("should normalize a blank seed when starting custom game", async () => {
    const { default: CustomGameRoute } = await import("@/routes/CustomGameRoute");

    render(<CustomGameRoute />);

    fireEvent.input(screen.getByLabelText("Seed"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start custom game" }));

    const worker = mockWorkers[0];
    expect(worker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "generate",
        config: expect.objectContaining({
          seed: expect.any(String),
        }),
      }),
    );
  });
});
