// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LeaderBoard from "@/components/dashboard/LeaderBoard";

const ENTRY = {
  user: null,
  playerName: "Budi",
  totalPlayed: 3,
  totalScore: 3000,
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        String(input).includes("/hidden") ? { data: [] } : { data: [ENTRY] },
    })),
  );
}

function renderBoard(canModerate: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeaderBoard canModerate={canModerate} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LeaderBoard moderation controls", () => {
  it("shows nothing to moderate on the public board and never fetches the hidden list", async () => {
    stubFetch();
    renderBoard(false);

    expect(await screen.findByText("Budi")).toBeTruthy();
    expect(screen.queryByLabelText("Sembunyikan Budi dari leaderboard")).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes("/hidden")),
    ).toBe(true);
  });

  it("offers a hide action on each entry to a couple member", async () => {
    stubFetch();
    renderBoard(true);

    expect(await screen.findByLabelText("Sembunyikan Budi dari leaderboard")).toBeTruthy();
  });

  it("shows a retry state, not an empty board, when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    renderBoard(false);

    expect(await screen.findByText("Leaderboard belum bisa dimuat")).toBeTruthy();
    expect(screen.queryByText("Belum ada skor")).toBeNull();
  });

  it("uses an explicit locale for scores so SSR and client markup match", async () => {
    const original = Number.prototype.toLocaleString;
    // Server default is en-ID ("3.000"); many browsers are en-US ("3,000").
    // Only an explicit id-ID call is allowed to produce the Indonesian format.
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (
      this: number,
      locales?: Intl.LocalesArgument,
    ) {
      return original.call(this, locales === "id-ID" ? "id-ID" : "en-US");
    });

    stubFetch();
    renderBoard(false);

    expect(await screen.findByText("3.000")).toBeTruthy();
  });
});
