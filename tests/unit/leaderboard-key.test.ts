import { describe, it, expect } from "vitest";
import { leaderboardPlayerKey, normalizeGuestName } from "@/lib/games/leaderboard-key";

describe("normalizeGuestName", () => {
  it("trims and lowercases so casing/whitespace cannot dodge a hide", () => {
    expect(normalizeGuestName("  Budi  ")).toBe("budi");
    expect(normalizeGuestName("BUDI")).toBe("budi");
  });
});

describe("leaderboardPlayerKey", () => {
  it("prefers the account id over a display name", () => {
    expect(leaderboardPlayerKey({ userId: "u1", playerName: "Budi" })).toBe("user:u1");
  });

  it("keys guests by normalized name", () => {
    expect(leaderboardPlayerKey({ userId: null, playerName: " Budi " })).toBe("guest:budi");
  });

  it("returns null when there is no identity to hide", () => {
    expect(leaderboardPlayerKey({ userId: null, playerName: null })).toBeNull();
    expect(leaderboardPlayerKey({ userId: "", playerName: "   " })).toBeNull();
  });
});
