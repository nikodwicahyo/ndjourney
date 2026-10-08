// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WouldYouRather from "@/components/games/WouldYouRather";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

const q = (id: string, n: number) => ({
  id,
  type: "WOULD_YOU_RATHER",
  question: `Pertanyaan ${n}?`,
  optionA: `Pilihan A${n}`,
  optionB: `Pilihan B${n}`,
  answer: null,
  category: null,
  createdAt: new Date().toISOString(),
});

// Bank of 10: first fetch serves q1-3, second (excluding q1-3) serves q4-6.
function mockBank() {
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    const second = u.includes("exclude=");
    return {
      ok: true,
      json: async () =>
        second
          ? { data: [q("q4", 4), q("q5", 5), q("q6", 6)], total: 10 }
          : { data: [q("q1", 1), q("q2", 2), q("q3", 3)], total: 10 },
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderGame() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <WouldYouRather disableScoreSubmit />
    </QueryClientProvider>,
  );
}

async function answerCurrent(optionName: string, nextQuestion: string) {
  fireEvent.click(screen.getByRole("button", { name: optionName }));
  await screen.findByText(nextQuestion, undefined, { timeout: 5000 });
}

// No-repeat contract: a fresh round never shows already-played questions
// until the bank is exhausted — replay excludes, immediately, no race.
describe("WouldYouRather no-repeat deck", () => {
  it(
    "Acak Ulang draws a fresh batch excluding the current one",
    async () => {
      const fetchMock = mockBank();
      renderGame();
      await screen.findByText("Pertanyaan 1?", undefined, { timeout: 5000 });

      fireEvent.click(screen.getByRole("button", { name: "Acak Ulang" }));
      await screen.findByText("Pertanyaan 4?", undefined, { timeout: 5000 });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondUrl = String(fetchMock.mock.calls[1]?.[0] ?? "");
      expect(secondUrl).toContain("exclude=");
      for (const id of ["q1", "q2", "q3"]) {
        expect(secondUrl).toContain(id);
      }
      // fresh batch rendered, round restarted
      expect(screen.queryByText("Pertanyaan 1?")).toBeNull();
    },
    20000,
  );

  it(
    "Main Lagi after a full round excludes every played question",
    async () => {
      const fetchMock = mockBank();
      renderGame();
      await screen.findByText("Pertanyaan 1?", undefined, { timeout: 5000 });

      await answerCurrent("Pilihan A1", "Pertanyaan 2?");
      await answerCurrent("Pilihan A2", "Pertanyaan 3?");
      await answerCurrent("Pilihan A3", "Selesai! 🎉");

      fireEvent.click(screen.getByRole("button", { name: "Main Lagi" }));
      await screen.findByText("Pertanyaan 4?", undefined, { timeout: 5000 });

      const secondUrl = String(fetchMock.mock.calls[1]?.[0] ?? "");
      for (const id of ["q1", "q2", "q3"]) {
        expect(secondUrl).toContain(id);
      }
      expect(screen.queryByText("Pertanyaan 1?")).toBeNull();
    },
    30000,
  );

  it(
    "quit mid-round then start over excludes answered questions",
    async () => {
      const fetchMock = mockBank();
      renderGame();
      await screen.findByText("Pertanyaan 1?", undefined, { timeout: 5000 });

      // Answer q1, then quit (unmount) before advancing — mid-round exit.
      fireEvent.click(screen.getByRole("button", { name: "Pilihan A1" }));
      cleanup();

      // Start over: the very first fetch must already exclude q1.
      renderGame();
      await screen.findByText("Pertanyaan 4?", undefined, { timeout: 5000 });

      const calls = fetchMock.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const restartUrl = String(calls[calls.length - 1]?.[0] ?? "");
      expect(restartUrl).toContain("exclude=");
      expect(restartUrl).toContain("q1");
      expect(screen.queryByText("Pertanyaan 1?")).toBeNull();
    },
    20000,
  );
});
