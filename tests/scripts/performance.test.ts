import { describe, expect, it } from "vitest";
import {
  applyNetworkThrottle,
  assertRouteMetrics,
  CLS_LIMIT,
  LCP_LIMIT_MS,
  NETWORK_THROTTLE,
  resolvePerformanceRoutes,
} from "../../scripts/performance.mjs";

const route = { label: "root", path: "/" };

const passingMetrics = {
  cls: 0,
  clsEntries: [],
  errors: [],
  lcp: 100,
  lcpEntries: [{ startTime: 100 }],
  observerTypes: ["largest-contentful-paint", "layout-shift"],
};

describe("performance gates", () => {
  it("uses 3G network throttling", () => {
    expect(NETWORK_THROTTLE).toMatchObject({
      downloadThroughput: ((500 * 1000) / 8) * 0.8,
      label: "3G",
      latency: 400 * 5,
      uploadThroughput: ((500 * 1000) / 8) * 0.8,
    });
  });

  it("disables browser cache before applying network throttling", async () => {
    const sentCommands: Array<{ method: string; params?: unknown }> = [];
    const page = {
      context: () => ({
        newCDPSession: async () => ({
          send: async (method: string, params?: unknown) => {
            sentCommands.push({ method, params });
          },
        }),
      }),
    };

    await applyNetworkThrottle(page);

    expect(sentCommands).toEqual([
      { method: "Network.enable", params: undefined },
      { method: "Network.setCacheDisabled", params: { cacheDisabled: true } },
      { method: "Network.setBypassServiceWorker", params: { bypass: true } },
      {
        method: "Network.emulateNetworkConditions",
        params: {
          connectionType: "cellular3g",
          downloadThroughput: NETWORK_THROTTLE.downloadThroughput,
          latency: NETWORK_THROTTLE.latency,
          offline: false,
          uploadThroughput: NETWORK_THROTTLE.uploadThroughput,
        },
      },
    ]);
  });

  it("resolves custom performance URL inputs", () => {
    expect(resolvePerformanceRoutes([])).toEqual([
      { label: "root", path: "/", readyText: "Math Crossword" },
      {
        label: "game/easy?stage=1",
        path: "/game/easy?stage=1",
        readyText: "Easy - Stage 1",
      },
      {
        label: "game/custom",
        path: "/game/custom",
        readyText: "Custom Game",
      },
    ]);
    expect(
      resolvePerformanceRoutes([
        "--",
        "http://localhost:4173/game/easy?stage=1",
        "http://localhost:4173/game/custom",
      ]),
    ).toEqual([
      {
        label: "game/easy?stage=1",
        path: "/game/easy?stage=1",
        readyText: "Easy - Stage 1",
      },
      {
        label: "game/custom",
        path: "/game/custom",
        readyText: "Custom Game",
      },
    ]);
  });

  it("passes measured LCP and CLS below the gates", () => {
    expect(() => assertRouteMetrics(route, passingMetrics, [], [])).not.toThrow();
  });

  it("throws when LCP measurement is missing", () => {
    expect(() => assertRouteMetrics(route, { ...passingMetrics, lcp: undefined }, [], [])).toThrow(
      "LCP measurement failed",
    );
  });

  it("throws when metric observers fail to start", () => {
    expect(() =>
      assertRouteMetrics(
        route,
        { ...passingMetrics, errors: ["PerformanceObserver is not available"] },
        [],
        [],
      ),
    ).toThrow("PerformanceObserver is not available");
  });

  it("throws when LCP or CLS exceeds the gates", () => {
    expect(() =>
      assertRouteMetrics(route, { ...passingMetrics, lcp: LCP_LIMIT_MS }, [], []),
    ).toThrow("LCP 2500.0ms exceeded");
    expect(() => assertRouteMetrics(route, { ...passingMetrics, cls: CLS_LIMIT }, [], [])).toThrow(
      "CLS 0.100000 exceeded",
    );
  });
});
