import type { ComponentChild } from "preact";
import { hydrate as nativeHydrate, render } from "preact";

export default function hydrate(
  jsx: ComponentChild,
  parent?: Element | Document | ShadowRoot | null,
) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const isodata = document.querySelector('script[type="isodata"]');
  const target = parent || isodata?.parentNode || document.getElementById("app") || document.body;

  if (isodata) {
    nativeHydrate(jsx, target as Element);
  } else {
    render(jsx, target as Element);
  }
}
