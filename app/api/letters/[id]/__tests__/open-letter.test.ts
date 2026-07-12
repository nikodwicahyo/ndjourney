import { describe, it } from "node:test";
import assert from "node:assert";

function isLocked(letter: {
  isTimeCapsule: boolean;
  unlockAt: Date | null;
  isOpened: boolean;
}): boolean {
  return (
    letter.isTimeCapsule &&
    letter.unlockAt !== null &&
    letter.unlockAt > new Date() &&
    !letter.isOpened
  );
}

describe("time capsule unlock guard", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 86_400_000);
  const past = new Date(now.getTime() - 86_400_000);

  it("rejects opening a locked time capsule", () => {
    assert.strictEqual(
      isLocked({ isTimeCapsule: true, unlockAt: future, isOpened: false }),
      true,
    );
  });

  it("allows opening an unlocked time capsule", () => {
    assert.strictEqual(
      isLocked({ isTimeCapsule: true, unlockAt: past, isOpened: false }),
      false,
    );
  });

  it("allows opening a non-time-capsule letter", () => {
    assert.strictEqual(
      isLocked({ isTimeCapsule: false, unlockAt: null, isOpened: false }),
      false,
    );
  });

  it("allows opening an already-opened time capsule", () => {
    assert.strictEqual(
      isLocked({ isTimeCapsule: true, unlockAt: future, isOpened: true }),
      false,
    );
  });

  it("allows opening a time capsule with null unlockAt", () => {
    assert.strictEqual(
      isLocked({ isTimeCapsule: true, unlockAt: null, isOpened: false }),
      false,
    );
  });
});
