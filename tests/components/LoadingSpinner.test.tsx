import { render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingSpinner } from "@/components/LoadingSpinner";

describe("LoadingSpinner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not render when hidden", () => {
    render(<LoadingSpinner isVisible={false} />);

    expect(screen.queryByLabelText("Loading screen")).toBeNull();
  });

  it("should render when visible", () => {
    render(<LoadingSpinner isVisible={true} />);

    expect(screen.getByLabelText("Loading screen")).toBeDefined();
  });

  it("should fade out before unmounting", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<LoadingSpinner isVisible />);

    rerender(<LoadingSpinner isVisible={false} />);

    expect(screen.getByLabelText("Loading screen").className).toContain("loading-screen-fading");
    await vi.advanceTimersByTimeAsync(240);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading screen")).toBeNull();
    });
  });
});
