import { useEffect } from "preact/hooks";

declare global {
  interface Window {
    __APP_READY__?: boolean;
    __APP_READY_ROUTE__?: string;
    __APP_RENDER_ERROR__?: string;
  }
}

export const useAppReadinessSignal = (ready: boolean, routeName: string) => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.__APP_READY__ = ready;
    window.__APP_READY_ROUTE__ = routeName;

    if (ready) {
      delete window.__APP_RENDER_ERROR__;
    }

    return () => {
      if (window.__APP_READY_ROUTE__ === routeName) {
        window.__APP_READY__ = false;
      }
    };
  }, [ready, routeName]);
};

export const reportAppRenderError = (error: Error) => {
  if (typeof window === "undefined") return;

  window.__APP_READY__ = false;
  window.__APP_RENDER_ERROR__ = error.message || String(error);
};
