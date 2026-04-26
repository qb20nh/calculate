import prerenderApp, { locationStub } from "preact-iso/prerender";
import { App } from "@/App";

// Mock browser globals for prerendering
if (typeof globalThis.window === "undefined") {
  const noop = () => {};
  const mockGlobal = globalThis as unknown as Window & typeof globalThis;

  mockGlobal.window = mockGlobal;
  mockGlobal.document = {
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({}),
    documentElement: { style: {} },
    body: { appendChild: noop },
  } as unknown as Document;

  mockGlobal.history = {
    pushState: noop,
    replaceState: noop,
  } as unknown as History;

  mockGlobal.addEventListener = noop;
  mockGlobal.removeEventListener = noop;
}

export async function prerender(data: Record<string, unknown>) {
  locationStub((data.url as string) || "/");
  return prerenderApp(<App />, { props: data });
}
