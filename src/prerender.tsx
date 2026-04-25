import { prerender as prerenderApp } from "preact-iso";
import { App } from "@/App";

export async function prerender(data: Record<string, unknown>) {
  return prerenderApp(<App />, { props: data });
}
