// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GameManager from "@/components/dashboard/GameManager";
import { GAME_QUESTION_MAX_LIMIT, GAME_QUESTION_PAGE_SIZE } from "@/lib/utils";

const state = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.search = "";
});

function question(n: number) {
  return {
    id: `q${n}`,
    type: "WOULD_YOU_RATHER",
    question: `Pertanyaan ${n}?`,
    optionA: `Opsi A${n}`,
    optionB: `Opsi B${n}`,
    answer: null,
    category: null,
    createdAt: new Date().toISOString(),
  };
}

const BANK = Array.from({ length: 12 }, (_, i) => question(i + 1));

function stubFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/games/questions/counts")) {
      return { ok: true, status: 200, json: async () => ({ data: { WOULD_YOU_RATHER: BANK.length } }) };
    }
    const limit = Number(new URL(u, "http://localhost").searchParams.get("limit"));
    const rows = BANK.slice(0, limit);
    return { ok: true, status: 200, json: async () => ({ data: rows }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderManager() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <GameManager />
    </QueryClientProvider>,
  );
}

function rowCount() {
  return screen.getAllByLabelText("Edit pertanyaan").length;
}

describe("GameManager question pagination", () => {
  it("shows the first page, then one click reveals the whole bank", async () => {
    const fetchMock = stubFetch();
    renderManager();

    // First page only: 10 rows, with the "more" button and the counter.
    await screen.findByText("Pertanyaan 1?");
    expect(rowCount()).toBe(GAME_QUESTION_PAGE_SIZE);
    expect(screen.queryByText("Pertanyaan 11?")).toBeNull();
    expect(screen.getByText(`Menampilkan ${GAME_QUESTION_PAGE_SIZE} dari ${BANK.length} pertanyaan`)).toBeTruthy();

    const button = screen.getByRole("button", { name: "Tampilkan semua" });
    fireEvent.click(button);

    // One request for the whole bank; the rest of the list appears and the
    // button goes away.
    await screen.findByText("Pertanyaan 12?");
    expect(rowCount()).toBe(BANK.length);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Tampilkan semua" })).toBeNull(),
    );

    const limits = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes("/api/games/questions?") && u.includes("limit="))
      .map((u) => Number(new URL(u, "http://localhost").searchParams.get("limit")));
    expect(limits).toContain(GAME_QUESTION_PAGE_SIZE);
    expect(limits).toContain(GAME_QUESTION_MAX_LIMIT);
  });

  it("does not show the button when the bank fits on one page", async () => {
    // A 7-question bank: first page already holds everything.
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/games/questions/counts")) {
        return { ok: true, status: 200, json: async () => ({ data: { WOULD_YOU_RATHER: 7 } }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: BANK.slice(0, 7) }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderManager();
    await screen.findByText("Pertanyaan 1?");
    expect(rowCount()).toBe(7);
    expect(screen.queryByRole("button", { name: "Tampilkan semua" })).toBeNull();
  });
});
