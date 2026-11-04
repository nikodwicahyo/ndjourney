// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { queryKeys } from "@/lib/query-keys";

// Captured `sync-mutate` handler from the mocked Pusher channel.
const bound = vi.hoisted(() => ({
  handler: undefined as ((data: unknown) => void) | undefined,
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ update: vi.fn() }) }));

vi.mock("@/lib/pusher-client", () => ({
  getPusherClient: () => ({
    subscribe: () => ({
      bind: (_event: string, handler: (data: unknown) => void) => {
        bound.handler = handler;
      },
      unbind: () => {},
    }),
    unsubscribe: () => {},
  }),
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { unmount } = renderHook(() => useRealtimeSync("couple-1"), { wrapper });
  return { client, invalidate, unmount };
}

function invalidatedKeys(spy: {
  mock: { calls: unknown[][] };
}): unknown[] {
  return spy.mock.calls.map(([arg]) => (arg as { queryKey: unknown }).queryKey);
}

describe("useRealtimeSync (notifications invalidation)", () => {
  it("invalidates notifications + dashboard activity for any activity payload", async () => {
    bound.handler = undefined;
    const { invalidate, unmount } = setup();
    try {
      await waitFor(() => expect(bound.handler).toBeDefined());
      act(() => {
        bound.handler!({
          scope: "GALLERY",
          action: "REFRESH",
          activity: { id: "evt1", type: "photo", title: "Foto baru" },
        });
      });

      const keys = invalidatedKeys(invalidate);
      expect(keys).toContainEqual(queryKeys.notifications.all);
      expect(keys).toContainEqual(queryKeys.dashboard.activity());
      const notificationsCall = invalidate.mock.calls.find(
        ([arg]) => (arg as { queryKey: unknown }).queryKey === queryKeys.notifications.all,
      )?.[0];
      expect(notificationsCall).toMatchObject({ refetchType: "all" });
    } finally {
      unmount();
    }
  });

  it("does not touch notifications when the payload carries no activity", async () => {
    bound.handler = undefined;
    const { invalidate, unmount } = setup();
    try {
      await waitFor(() => expect(bound.handler).toBeDefined());
      act(() => {
        bound.handler!({ scope: "GALLERY", action: "REFRESH" });
      });

      expect(invalidatedKeys(invalidate)).not.toContainEqual(queryKeys.notifications.all);
    } finally {
      unmount();
    }
  });
});
