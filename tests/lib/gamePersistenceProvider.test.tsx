import { act, cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamePersistenceProvider, useGamePersistence } from "@/lib/gamePersistence";
import type { GameState } from "@/services/storage";

type PersistenceValue = ReturnType<typeof useGamePersistence>;

const makeState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    board: {},
    bank: [],
    initialBankSize: 0,
    status: "playing",
    difficulty: "Easy",
    stage: 1,
    ...overrides,
  }) as GameState;

const Probe = ({ onValue }: { onValue: (value: PersistenceValue) => void }) => {
  const value = useGamePersistence();
  onValue(value);
  return null;
};

const requirePersistence = (value: PersistenceValue | null): PersistenceValue => {
  if (value === null) throw new Error("Expected persistence context");
  return value;
};

describe("GamePersistenceProvider", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires a provider before using persistence context", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const Consumer = () => {
      useGamePersistence();
      return null;
    };

    expect(() => render(<Consumer />)).toThrow(
      "useGamePersistence must be used inside GamePersistenceProvider",
    );
    consoleError.mockRestore();
  });

  it("hydrates storage and exposes progress, restore, and save actions", async () => {
    const activeState = makeState({ stage: 2 });
    const clearedState = makeState({
      status: "won",
      solvedAcknowledged: true,
    });
    localStorage.setItem(
      "math_scrabble_progress",
      JSON.stringify({
        Easy: { current: 1, max: 3 },
        Medium: { current: 1, max: 1 },
        Hard: { current: 1, max: 1 },
        Crossing: { current: 1, max: 1 },
      }),
    );
    localStorage.setItem("math_scrabble_state", JSON.stringify(activeState));
    localStorage.setItem(
      "math_scrabble_cleared_states",
      JSON.stringify({ "Easy:1": clearedState }),
    );

    let persistence: PersistenceValue | null = null;
    render(
      <GamePersistenceProvider>
        <Probe
          onValue={(value) => {
            persistence = value;
          }}
        />
      </GamePersistenceProvider>,
    );

    await waitFor(() => {
      expect(persistence?.isHydrated).toBe(true);
    });

    expect(requirePersistence(persistence).getLatestUnlockedStage("Easy")).toBe(3);
    expect(requirePersistence(persistence).isStageLocked("Easy", 4)).toBe(true);
    expect(requirePersistence(persistence).getStageRestore("Easy", 1).state).toEqual(clearedState);
    expect(requirePersistence(persistence).getStageRestore("Easy", 2).state).toEqual(activeState);

    act(() => requirePersistence(persistence).setCurrentStage("Easy", 4, { unlock: true }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("math_scrabble_progress") ?? "{}").Easy).toEqual({
        current: 4,
        max: 4,
      });
    });

    act(() => requirePersistence(persistence).unlockStage("Medium", 2));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("math_scrabble_progress") ?? "{}").Medium).toEqual({
        current: 1,
        max: 2,
      });
    });

    const wonState = makeState({ status: "won", stage: 3 });
    act(() => requirePersistence(persistence).saveStageState(wonState));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("math_scrabble_state") ?? "{}")).toMatchObject({
        difficulty: "Easy",
        stage: 3,
        status: "won",
      });
      expect(
        JSON.parse(localStorage.getItem("math_scrabble_cleared_states") ?? "{}"),
      ).toHaveProperty("Easy:3");
    });

    act(() => requirePersistence(persistence).saveActiveState(null));
    await waitFor(() => {
      expect(localStorage.getItem("math_scrabble_state")).toBeNull();
    });
  });
});
