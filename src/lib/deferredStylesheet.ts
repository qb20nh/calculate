const deferredRootStyleSelector = 'link[data-root-deferred-style][rel="stylesheet"]';
const stylesheetLoadPromises = new WeakMap<HTMLLinkElement, Promise<void>>();
let scheduledApplyHandle: ReturnType<typeof setTimeout> | number | undefined;

const isStylesheetLoaded = (stylesheet: HTMLLinkElement) => stylesheet.sheet !== null;

const materializeStylesheet = (stylesheet: HTMLLinkElement, fetchPriority: "high" | "low") => {
  const deferredHref = stylesheet.dataset.href;
  if (deferredHref && !stylesheet.href) {
    stylesheet.href = deferredHref;
  }
  stylesheet.setAttribute("fetchpriority", fetchPriority);
};

const waitForStylesheet = (stylesheet: HTMLLinkElement) => {
  const existingPromise = stylesheetLoadPromises.get(stylesheet);
  if (existingPromise) return existingPromise;

  const loadPromise = new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      stylesheet.removeEventListener("load", finish);
      stylesheet.removeEventListener("error", finish);
      resolve();
    };

    stylesheet.addEventListener("load", finish, { once: true });
    stylesheet.addEventListener("error", finish, { once: true });
    materializeStylesheet(stylesheet, "high");
    stylesheet.media = "all";

    if (isStylesheetLoaded(stylesheet)) {
      setTimeout(finish, 0);
      return;
    }

    timeoutId = setTimeout(finish, 8000);
  });

  stylesheetLoadPromises.set(stylesheet, loadPromise);
  return loadPromise;
};

export const applyDeferredStylesheets = () => {
  if (typeof document === "undefined") return;

  for (const stylesheet of document.querySelectorAll<HTMLLinkElement>(deferredRootStyleSelector)) {
    if (stylesheet.media === "all" && stylesheet.getAttribute("href")) continue;
    materializeStylesheet(stylesheet, "high");
    stylesheet.media = "all";
  }
};

export const scheduleDeferredStylesheets = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (scheduledApplyHandle !== undefined) return;

  const apply = () => {
    scheduledApplyHandle = undefined;
    applyDeferredStylesheets();
  };

  if ("requestIdleCallback" in window) {
    scheduledApplyHandle = window.requestIdleCallback(apply, { timeout: 3000 });
    return;
  }

  scheduledApplyHandle = setTimeout(apply, 1500);
};

export const ensureDeferredStylesheets = () => {
  if (typeof document === "undefined") return undefined;

  const stylesheets = [...document.querySelectorAll<HTMLLinkElement>(deferredRootStyleSelector)];
  if (stylesheets.length === 0) return undefined;

  return Promise.all(stylesheets.map(waitForStylesheet)).then(() => undefined);
};
