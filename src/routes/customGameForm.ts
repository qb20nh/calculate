import { normalizeSeed } from "@/routes/customGameHelpers";
import type { CustomGameConfig } from "@/services/storage";

export const buildCustomConfigFromDraft = (draft: CustomGameConfig): CustomGameConfig => ({
  givenCount: Number(draft.givenCount),
  inventoryCount: Number(draft.inventoryCount),
  sizeLimit: Number(draft.sizeLimit),
  seed: normalizeSeed(String(draft.seed)),
  limitSolutionSize: Boolean(draft.limitSolutionSize),
});
