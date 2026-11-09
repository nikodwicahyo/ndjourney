// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";

// next-auth's client collapses a failed /api/auth/session probe (offline
// fetch, 5xx, SW offline 503) into `null` — the watcher must not mistake that
// for expiry, and must self-heal the provider when the session is still valid.
const auth = vi.hoisted(() => ({
  session: null as { user?: { id: string } } | null,
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
  update: vi.fn(async () => null),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSession: () => ({ data: auth.session, status: auth.status, update: auth.update }),
  signOut: vi.fn(async () => ({})),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { default: SessionProvider } = await import("@/components/SessionProvider");
const { toast } = await import("sonner");

/** Flush the verification promise chain (fetch → json → state) to completion. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Render signed-in first (the watcher only guards authenticated → null). */
function expireAfterAuthenticated() {
  const view = render(
    <SessionProvider>
      <span>before</span>
    </SessionProvider>,
  );
  auth.status = "unauthenticated";
  auth.session = null;
  view.rerender(
    <SessionProvider>
      <span>after</span>
    </SessionProvider>,
  );
  return view;
}

describe("SessionWatcher (false expiry guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.status = "authenticated";
    auth.session = { user: { id: "u1" } };
  });

  afterEach(cleanup);

  it("stays silent when the session probe fails (offline / 503)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expireAfterAuthenticated();
    await settle();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays silent when the probe returns 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Offline", { status: 503 })));
    expireAfterAuthenticated();
    await settle();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts once when the server confirms there is no session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    expireAfterAuthenticated();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it("self-heals the provider without toasting when the session is still valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }),
      ),
    );
    expireAfterAuthenticated();
    await waitFor(() => expect(auth.update).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
