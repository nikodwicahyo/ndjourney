import { describe, expect, it } from "vitest";
import { isLetterLocked } from "@/lib/letter-lock";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const FUTURE = "2026-11-01T00:00:00.000Z";
const PAST = "2026-10-01T00:00:00.000Z";

describe("isLetterLocked (canonical time-capsule rule)", () => {
  it("never locks a non-capsule, even with a stray future unlockAt", () => {
    expect(
      isLetterLocked({ isTimeCapsule: false, unlockAt: FUTURE, isOpened: false }, NOW),
    ).toBe(false);
    expect(
      isLetterLocked({ isTimeCapsule: false, unlockAt: null, isOpened: false }, NOW),
    ).toBe(false);
  });

  it("locks an unopened capsule with a future unlockAt", () => {
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: FUTURE, isOpened: false }, NOW),
    ).toBe(true);
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: new Date(FUTURE), isOpened: false }, NOW),
    ).toBe(true);
  });

  it("unlocks once the time has passed", () => {
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: PAST, isOpened: false }, NOW),
    ).toBe(false);
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: new Date(NOW), isOpened: false }, NOW),
    ).toBe(false);
  });

  it("never locks an opened capsule", () => {
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: FUTURE, isOpened: true }, NOW),
    ).toBe(false);
  });

  it("fails open on malformed unlockAt", () => {
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: "not-a-date", isOpened: false }, NOW),
    ).toBe(false);
    expect(
      isLetterLocked({ isTimeCapsule: true, unlockAt: null, isOpened: false }, NOW),
    ).toBe(false);
  });
});
