import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import { CUSTOM_GAME_RETRY_LIMIT } from "@/services/customGameGeneration";

export function CustomGameLoading({
  retryCount,
  onCancel,
}: Readonly<{ retryCount: number; onCancel: () => void }>) {
  const { copy, t } = useAppSettings();
  useAppReadinessSignal(false, "custom-loading");

  return (
    <div className="theme-page-bg h-dvh w-full flex items-center justify-center p-4">
      <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4">
          <div
            id="custom-generation-spinner"
            className="size-14 shrink-0 animate-spin rounded-full border-4 theme-spinner"
          />
          <div className="grid gap-1">
            <h1 className="text-2xl font-black tracking-tight">{copy.custom.loadingTitle}</h1>
            <p className="font-medium theme-muted-text">
              {t("custom.retryLabel", { retryCount, totalRetries: CUSTOM_GAME_RETRY_LIMIT })}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl theme-panel-strong px-4 py-3 text-sm font-medium">
          {copy.custom.loadingHint}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-6 w-full rounded-2xl border theme-border px-5 py-4 font-bold transition active:scale-95"
        >
          {copy.custom.cancel}
        </button>
      </div>
    </div>
  );
}
