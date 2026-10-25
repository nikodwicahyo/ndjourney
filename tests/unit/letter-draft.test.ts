// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLetterDraft,
  isLetterDraftEmpty,
  letterDraftKey,
  loadLetterDraft,
  saveLetterDraft,
  type LetterDraftFields,
} from "@/lib/letter-draft";

const fields: LetterDraftFields = {
  title: "Untuk kamu",
  content: "<p>Hai sayang, aku kangen.</p>",
  mood: "MISSING",
  isTimeCapsule: false,
  unlockDate: "",
  unlockTime: "00:00",
};

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("letter draft storage", () => {
  it("round-trips a draft", () => {
    const savedAt = saveLetterDraft("u1", fields);
    expect(savedAt).toBeTypeOf("number");
    expect(loadLetterDraft("u1")).toMatchObject({ ...fields, savedAt });
  });

  it("keeps drafts per user", () => {
    saveLetterDraft("u1", fields);
    expect(loadLetterDraft("u2")).toBeNull();
  });

  it("never stores an empty draft", () => {
    expect(
      saveLetterDraft("u1", { ...fields, title: "  ", content: "<p></p>" }),
    ).toBeNull();
    expect(loadLetterDraft("u1")).toBeNull();
    expect(isLetterDraftEmpty({ title: "", content: "<p><br></p>" })).toBe(true);
  });

  it("drops malformed payloads", () => {
    localStorage.setItem(letterDraftKey("u1"), "{not json");
    expect(loadLetterDraft("u1")).toBeNull();
    expect(localStorage.getItem(letterDraftKey("u1"))).toBeNull();
  });

  it("drops drafts from an incompatible version", () => {
    localStorage.setItem(
      letterDraftKey("u1"),
      JSON.stringify({ ...fields, version: 99, savedAt: Date.now() }),
    );
    expect(loadLetterDraft("u1")).toBeNull();
  });

  it("expires drafts after 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(saveLetterDraft("u1", fields)).toBeTypeOf("number");

    vi.setSystemTime(new Date("2026-01-20T00:00:00Z"));
    expect(loadLetterDraft("u1")).not.toBeNull();

    vi.setSystemTime(new Date("2026-02-15T00:00:00Z"));
    expect(loadLetterDraft("u1")).toBeNull();
  });

  it("clears the saved draft", () => {
    saveLetterDraft("u1", fields);
    clearLetterDraft("u1");
    expect(loadLetterDraft("u1")).toBeNull();
  });
});
