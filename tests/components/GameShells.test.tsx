import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { GameLoadingShell } from "@/components/game/GameShells";
import { AppSettingsProvider } from "@/lib/appSettings";

describe("GameShells", () => {
  it("renders an optional loading notice", () => {
    render(
      <AppSettingsProvider>
        <GameLoadingShell
          difficulty="Easy"
          stage={1}
          maxStage={1}
          notice="Loading saved stage"
          onBack={vi.fn()}
          onStageChange={vi.fn()}
        />
      </AppSettingsProvider>,
    );

    expect(screen.getByText("Loading saved stage")).toBeDefined();
  });
});
