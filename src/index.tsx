import { hydrate } from "preact-iso";
import { App } from "@/App";
import "@/style.css";

if (typeof window !== "undefined") {
  const appElement = document.getElementById("app");
  if (appElement) {
    hydrate(<App />, appElement);
  }
}

export { App } from "@/App";
