import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { LoadingSpinner } from "@/components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should not render when hidden", () => {
    render(<LoadingSpinner isVisible={false} />);

    expect(screen.queryByLabelText("Loading screen")).toBeNull();
  });

  it("should render when visible", () => {
    render(<LoadingSpinner isVisible={true} />);

    expect(screen.getByLabelText("Loading screen")).toBeDefined();
  });
});
