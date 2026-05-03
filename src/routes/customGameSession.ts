import { sameCustomConfig } from "@/routes/customGameHelpers";
import {
  addBasePath,
  parseCustomGameConfig,
  parseCustomGameRetryCount,
  toCustomGamePath,
} from "@/routes/routeUtils";
import type { CustomGameConfig, GameState } from "@/services/storage";

type CustomGameSessionInput = {
  isHydrated: boolean;
  locationUrl: string;
  savedState: GameState | null;
};

type CustomGameSession = {
  hasRetryCountInUrl: boolean;
  invalidUrl: boolean;
  parsedConfig: CustomGameConfig | null;
  parsedRetryCount: number;
  resumeSavedGame: GameState | null;
};

export const resolveCustomGameSession = (input: CustomGameSessionInput): CustomGameSession => {
  const searchParams = new URL(input.locationUrl, "http://localhost").searchParams;
  const parsedConfig = parseCustomGameConfig(searchParams);
  const parsedRetryCount = parseCustomGameRetryCount(searchParams);
  const hasRetryCountInUrl = searchParams.has("retryCount");
  const savedCustomConfig =
    input.isHydrated && input.savedState?.difficulty === "Custom"
      ? input.savedState.customConfig
      : null;
  const resumeSavedGame =
    input.isHydrated &&
    parsedConfig &&
    input.savedState &&
    sameCustomConfig(savedCustomConfig, parsedConfig, hasRetryCountInUrl)
      ? input.savedState
      : null;

  return {
    hasRetryCountInUrl,
    invalidUrl: parsedConfig === null && searchParams.toString().length > 0,
    parsedConfig,
    parsedRetryCount,
    resumeSavedGame,
  };
};

export const getCustomGameUrlSyncPath = (
  config: CustomGameConfig,
  retryCount: number,
  currentPath: string,
) => {
  const nextPath = addBasePath(toCustomGamePath(config, retryCount));
  return currentPath === nextPath ? null : nextPath;
};
