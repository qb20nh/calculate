import type { ComponentChildren } from "preact";
import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import type { CustomGameConfig } from "@/services/storage";

type FieldProps = {
  label: string;
  htmlFor: string;
  children: ComponentChildren;
};

const Field = ({ label, htmlFor, children }: FieldProps) => (
  <div className="grid gap-2">
    <label htmlFor={htmlFor} className="text-sm font-bold theme-muted-text">
      {label}
    </label>
    {children}
  </div>
);

export function CustomGameSetup({
  draft,
  error,
  onBackToMenu,
  onDraftChange,
  onSubmit,
}: Readonly<{
  draft: CustomGameConfig;
  error: string | null;
  onBackToMenu: () => void;
  onDraftChange: (next: CustomGameConfig) => void;
  onSubmit: () => void;
}>) {
  const { copy } = useAppSettings();
  useAppReadinessSignal(true, "custom-setup");

  return (
    <div className="theme-page-bg h-dvh w-full flex items-center justify-center p-4">
      <div className="theme-panel w-full max-w-lg rounded-3xl p-6 shadow-xl md:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{copy.custom.title}</h1>
            <p className="mt-2 font-medium theme-muted-text">{copy.custom.subtitle}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <Field label={copy.custom.givenCount} htmlFor="custom-given-count">
            <input
              id="custom-given-count"
              type="number"
              min="1"
              step="1"
              value={draft.givenCount}
              onInput={(event) =>
                onDraftChange({
                  ...draft,
                  givenCount: Number(event.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.inventoryCount} htmlFor="custom-inventory-count">
            <input
              id="custom-inventory-count"
              type="number"
              min="1"
              step="1"
              value={draft.inventoryCount}
              onInput={(event) =>
                onDraftChange({
                  ...draft,
                  inventoryCount: Number(event.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.sizeLimit} htmlFor="custom-size-limit">
            <input
              id="custom-size-limit"
              type="number"
              min="1"
              step="1"
              value={draft.sizeLimit}
              onInput={(event) =>
                onDraftChange({
                  ...draft,
                  sizeLimit: Number(event.currentTarget.value),
                })
              }
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <Field label={copy.custom.seed} htmlFor="custom-seed">
            <input
              id="custom-seed"
              type="text"
              value={draft.seed}
              onInput={(event) =>
                onDraftChange({
                  ...draft,
                  seed: event.currentTarget.value,
                })
              }
              placeholder={copy.custom.seedPlaceholder}
              className="theme-input rounded-2xl px-4 py-3 outline-none"
            />
          </Field>

          <div className="theme-panel rounded-2xl p-4">
            <label className="flex gap-3">
              <input
                id="custom-limit-solution-size"
                type="checkbox"
                checked={draft.limitSolutionSize}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    limitSolutionSize: event.currentTarget.checked,
                  })
                }
                className="mt-1 h-4 w-4 shrink-0 rounded border theme-border text-[var(--theme-ink)]"
              />
              <span className="text-sm font-bold">{copy.custom.limitSolutionSize}</span>
            </label>
            <p className="mt-2 text-sm leading-6 theme-muted-text">
              {copy.custom.limitSolutionSizeDescription}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="rounded-2xl border theme-border px-5 py-4 font-bold transition active:scale-95"
          >
            {copy.custom.backToMenu}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-2xl theme-primary-bg px-5 py-4 font-bold text-white shadow-xl transition active:scale-95"
          >
            {copy.custom.start}
          </button>
        </div>
      </div>
    </div>
  );
}
