import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { AppChrome } from "@/components/AppChrome";

const mockRoute = { path: "/" };
type ThemePreference = "dark" | "light" | "system";

let mockTheme: ThemePreference = "dark";

const mockUseAppSettings = {
  cycleThemePreference: vi.fn(),
  toggleLocale: vi.fn(),
  get preferences() {
    return { theme: mockTheme };
  },
  copy: {
    aria: {
      themeToggle: "Theme",
      languageToggle: "Language",
    },
  },
};

vi.mock("@/lib/appSettings", () => ({
  useAppSettings: vi.fn(() => mockUseAppSettings),
}));

vi.mock("preact-iso/router", () => ({
  useLocation: vi.fn(() => mockRoute),
}));

describe("AppChrome", () => {
  it("renders on home route for all theme preferences", () => {
    const { rerender } = render(<AppChrome />);

    mockTheme = "dark";
    rerender(<AppChrome />);
    expect(screen.getByLabelText("Theme")).toBeDefined();
    expect(screen.getByLabelText("Language")).toBeDefined();

    mockTheme = "light";
    rerender(<AppChrome />);
    expect(screen.getByLabelText("Theme")).toBeDefined();
    expect(screen.getByLabelText("Language")).toBeDefined();

    mockTheme = "system";
    rerender(<AppChrome />);
    expect(screen.getByLabelText("Theme")).toBeDefined();
    expect(screen.getByLabelText("Language")).toBeDefined();
  });

  it("does not render outside the home route", () => {
    mockRoute.path = "/game";
    render(<AppChrome />);
    expect(screen.queryByLabelText("Theme")).toBeNull();
    expect(screen.queryByLabelText("Language")).toBeNull();
  });
});
