import { describe, expect, it } from "vitest";
import { injectLoadingScriptPlugin } from "../../build/injectLoadingScriptPlugin";

describe("injectLoadingScriptPlugin", () => {
  it("should inject the full trickle function body", async () => {
    const plugin = injectLoadingScriptPlugin();
    const html = "<script>/* __PROGRESS_LOGIC_PLACEHOLDER__ */</script>";
    const transform = plugin.transformIndexHtml;
    if (!transform) throw new Error("Missing transformIndexHtml hook");
    type TransformIndexHtmlHook = (
      html: string,
      context?: { filename?: string },
    ) => string | Promise<string>;
    const handler = (
      typeof transform === "function" ? transform : transform.handler
    ) as TransformIndexHtmlHook;
    const output = await handler(html, { filename: "index.html" });

    expect(output).toContain("var getNextTrickleProgress = (prev) => {");
    expect(output).toContain("const remaining = Math.max(0, 90 - prev);");
    expect(output).toContain("return prev + (remaining / 10) * Math.random();");
    expect(output).not.toContain("Unexpected token");
  });
});
