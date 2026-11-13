import { describe, it, expect } from "vitest";
import {
  DAILY_LOVE_TASKS,
  formatLoveTaskHistoryDate,
  getDailyLoveTaskForDate,
  getLoveTaskHistory,
  getLoveTaskStreak,
  isDailyLoveTask,
  isLoveTaskDayKey,
  pickNextLoveTask,
  previousDayKey,
} from "@/lib/daily-love-task";

describe("daily love task rotation", () => {
  it("has a full year of unique tasks", () => {
    expect(DAILY_LOVE_TASKS).toHaveLength(365);
    expect(new Set(DAILY_LOVE_TASKS).size).toBe(365);
  });

  it("is deterministic per Jakarta day and changes every day", () => {
    expect(getDailyLoveTaskForDate("2026-11-14")).toBe(
      getDailyLoveTaskForDate("2026-11-14"),
    );
    expect(getDailyLoveTaskForDate("2026-11-14")).not.toBe(
      getDailyLoveTaskForDate("2026-11-15"),
    );
  });

  it("rotates from the documented start day", () => {
    expect(getDailyLoveTaskForDate("2024-01-01")).toBe(DAILY_LOVE_TASKS[0]);
    expect(getDailyLoveTaskForDate("2024-01-02")).toBe(DAILY_LOVE_TASKS[1]);
  });

  it("always returns a canonical task, even for an invalid day", () => {
    expect(DAILY_LOVE_TASKS).toContain(getDailyLoveTaskForDate("not-a-day"));
    expect(isDailyLoveTask(getDailyLoveTaskForDate("2026-02-30"))).toBe(true);
  });
});

describe("daily love task day keys", () => {
  it("rejects impossible calendar days", () => {
    expect(isLoveTaskDayKey("2026-11-14")).toBe(true);
    expect(isLoveTaskDayKey("2026-02-30")).toBe(false);
    expect(isLoveTaskDayKey("14-11-2026")).toBe(false);
  });

  it("walks backwards across month, year, and leap boundaries", () => {
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
    expect(previousDayKey("2024-03-01")).toBe("2024-02-29");
  });
});

describe("daily love task streak", () => {
  it("counts today and yesterday chains", () => {
    expect(
      getLoveTaskStreak(["2026-11-14", "2026-11-13", "2026-11-12"], "2026-11-14"),
    ).toBe(3);
  });

  it("keeps yesterday's streak alive before today is done", () => {
    expect(getLoveTaskStreak(["2026-11-13", "2026-11-12"], "2026-11-14")).toBe(2);
  });

  it("resets after a missed day", () => {
    expect(getLoveTaskStreak(["2026-11-12", "2026-11-11"], "2026-11-14")).toBe(0);
  });

  it("is zero with no completions", () => {
    expect(getLoveTaskStreak([], "2026-11-14")).toBe(0);
  });
});

describe("daily love task history", () => {
  it("dedupes by task, keeps the newest date, newest first", () => {
    const history = getLoveTaskHistory([
      { task: "A", date: "2026-11-12" },
      { task: "B", date: "2026-11-13" },
      { task: "A", date: "2026-11-14" },
    ]);
    expect(history).toEqual([
      { task: "A", date: "2026-11-14" },
      { task: "B", date: "2026-11-13" },
    ]);
  });

  it("is bounded", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      task: `T${i}`,
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
    }));
    expect(getLoveTaskHistory(rows, 3)).toHaveLength(3);
  });

  it("keeps every distinct completed task by default (no repeat before 365)", () => {
    const start = Date.UTC(2025, 0, 1);
    const rows = DAILY_LOVE_TASKS.map((task, i) => ({
      task,
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    }));
    const history = getLoveTaskHistory(rows);
    expect(history).toHaveLength(365);
    expect(history[0].date).toBe(rows[rows.length - 1].date);
  });

  it("formats the completion date with a year only when it differs", () => {
    expect(formatLoveTaskHistoryDate("2026-11-14", "2026-11-14")).toContain("14");
    expect(formatLoveTaskHistoryDate("2025-11-14", "2026-11-14")).toContain("2025");
    expect(formatLoveTaskHistoryDate("", "2026-11-14")).toBe("");
  });
});

describe("next task picker", () => {
  it("never repeats the current task or an already completed one", () => {
    const history = [{ task: DAILY_LOVE_TASKS[1], date: "2026-11-13" }];
    const picked = pickNextLoveTask(DAILY_LOVE_TASKS[0], history, () => 0);
    expect(picked).not.toBe(DAILY_LOVE_TASKS[0]);
    expect(picked).not.toBe(DAILY_LOVE_TASKS[1]);
    expect(isDailyLoveTask(picked)).toBe(true);
  });

  it("offers the last unseen task when every other task is completed", () => {
    const current = DAILY_LOVE_TASKS[0];
    const lastUnseen = DAILY_LOVE_TASKS[200];
    const history = DAILY_LOVE_TASKS.filter(
      (task) => task !== current && task !== lastUnseen,
    ).map((task) => ({ task, date: "2026-01-01" }));

    expect(pickNextLoveTask(current, history, () => 0.99)).toBe(lastUnseen);
  });

  it("falls back to a different task when the bank is exhausted", () => {
    const current = DAILY_LOVE_TASKS[0];
    const history = DAILY_LOVE_TASKS.slice(1).map((task) => ({ task, date: "2026-11-13" }));
    expect(pickNextLoveTask(current, history, () => 0)).not.toBe(current);
  });
});
