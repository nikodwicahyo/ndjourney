// @vitest-environment jsdom
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useBackgroundLocationStatus } from "@/hooks/useBackgroundLocation";

function Status() {
  return createElement("span", null, useBackgroundLocationStatus());
}

describe("useBackgroundLocationStatus SSR", () => {
  // Private pages (dashboard/location) are server-rendered. React throws
  // without getServerSnapshot, taking the whole page down in production.
  it("renders on the server with a stable idle snapshot", () => {
    expect(() => renderToString(createElement(Status))).not.toThrow();
    expect(renderToString(createElement(Status))).toContain("idle");
  });
});
