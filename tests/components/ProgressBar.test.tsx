import { render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressBar } from "@/components/ProgressBar";

describe("ProgressBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not render when not loading", () => {
    const { container } = render(<ProgressBar isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render when loading", () => {
    const { container } = render(<ProgressBar isLoading={true} />);

    // Fast-forward to make it visible (useProgressBar has a 0ms timeout for coordination)
    vi.runOnlyPendingTimers();

    expect(container.firstChild).not.toBeNull();
    expect(container.firstElementChild?.tagName).toBe("PROGRESS");
    expect(container.firstElementChild?.getAttribute("role")).toBeNull();
  });
});
