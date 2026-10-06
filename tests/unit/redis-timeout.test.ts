import { describe, it, expect, vi } from "vitest";
import { withRedisTimeout } from "@/lib/redis";

// Fail-open must be fast: a black-holed Redis host stalls ~4s+ per call,
// so every round-trip is bounded (2s) instead of hanging callers like login.
describe("withRedisTimeout", () => {
  it("passes fast resolutions through untouched", async () => {
    await expect(withRedisTimeout(Promise.resolve(7))).resolves.toBe(7);
  });

  it("rejects after the bound on a hung promise", async () => {
    vi.useFakeTimers();
    try {
      const pending = withRedisTimeout(new Promise<never>(() => {}));
      const assertion = expect(pending).rejects.toThrow("[redis] timeout");
      await vi.advanceTimersByTimeAsync(2000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
