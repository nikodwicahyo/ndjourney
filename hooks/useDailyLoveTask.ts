"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";
import {
  getDailyLoveTaskForDate,
  getLoveTaskHistory,
  isDailyLoveTask,
  pickNextLoveTask,
  previousDayKey,
  type DailyLoveTaskHistoryEntry,
  type DailyLoveTaskState,
} from "@/lib/daily-love-task";

// Guest fallback only. Authenticated users always read the server, so this
// never becomes a second source of truth for a signed-in account.
const LOCAL_STATE_KEY = "dailylovetask-state-v2";
const LEGACY_DONE_KEY = "dailylovetask-done";
const LEGACY_HISTORY_KEY = "dailylovetask-history";
const LEGACY_STREAK_KEY = "dailylovetask-streak";

type LocalState = DailyLoveTaskState;

export type DailyLoveTaskSyncState = "synced" | "syncing" | "guest" | "error";

export type DailyLoveTaskView = DailyLoveTaskState & {
  saving: boolean;
  syncState: DailyLoveTaskSyncState;
  toggleDone: () => void;
  nextTask: () => void;
};

function fallbackState(todayKey: string): DailyLoveTaskState {
  return {
    date: todayKey,
    task: getDailyLoveTaskForDate(todayKey),
    done: false,
    streak: 0,
    history: [],
  };
}

function normalizeHistory(raw: unknown): DailyLoveTaskHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: DailyLoveTaskHistoryEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      // Legacy guest history was a plain string[] with no dates.
      if (isDailyLoveTask(item)) entries.push({ task: item, date: "" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { task?: unknown; date?: unknown };
    if (typeof record.task === "string" && isDailyLoveTask(record.task)) {
      entries.push({
        task: record.task,
        date: typeof record.date === "string" ? record.date : "",
      });
    }
  }
  return getLoveTaskHistory(entries);
}

function readLegacyState(todayKey: string) {
  let done = false;
  let streak = 0;

  try {
    const raw = localStorage.getItem(LEGACY_DONE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date?: string; done?: boolean }) : null;
    done = parsed?.date === todayKey && parsed?.done === true;
  } catch {}

  try {
    const raw = localStorage.getItem(LEGACY_STREAK_KEY);
    const parsed = raw ? (JSON.parse(raw) as { streak?: number; date?: string }) : null;
    const value =
      typeof parsed?.streak === "number" && Number.isFinite(parsed.streak)
        ? Math.max(Math.floor(parsed.streak), 0)
        : 0;
    if (parsed?.date === todayKey) {
      // Old code only stamped today's date after completing, so a `done:false`
      // pair is inconsistent — don't count a day that was never completed.
      streak = done ? value : Math.max(value - 1, 0);
    } else if (parsed?.date === previousDayKey(todayKey)) {
      streak = value;
    }
  } catch {}

  let history: DailyLoveTaskHistoryEntry[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
    history = normalizeHistory(raw ? JSON.parse(raw) : null);
  } catch {}

  const fallback = fallbackState(todayKey);
  return { ...fallback, done, streak, history };
}

function readLocalState(todayKey: string): LocalState {
  const fallback = fallbackState(todayKey);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalState> | null) : null;
    if (parsed && typeof parsed === "object") {
      const sameDay = parsed.date === todayKey;
      const done = sameDay && parsed.done === true;
      const storedStreak =
        typeof parsed.streak === "number" && Number.isFinite(parsed.streak)
          ? Math.max(Math.floor(parsed.streak), 0)
          : 0;
      const streak =
        sameDay || (parsed.date === previousDayKey(todayKey) && parsed.done === true)
          ? storedStreak
          : 0;

      return {
        date: todayKey,
        task:
          sameDay && typeof parsed.task === "string" && isDailyLoveTask(parsed.task)
            ? parsed.task
            : fallback.task,
        done,
        streak,
        history: normalizeHistory(parsed.history),
      };
    }
  } catch {}

  return readLegacyState(todayKey);
}

function writeLocalState(state: LocalState): void {
  try {
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function withHistory(
  history: DailyLoveTaskHistoryEntry[],
  task: string,
  todayKey: string,
  done: boolean,
): DailyLoveTaskHistoryEntry[] {
  if (done) {
    return [{ task, date: todayKey }, ...history.filter((entry) => entry.task !== task)];
  }
  return history.filter((entry) => !(entry.task === task && entry.date === todayKey));
}

/**
 * One source for the card. Signed-in users read/write the server (per-user,
 * therefore identical on every device); guests keep the previous localStorage
 * behavior as a fallback. Real-time invalidation is handled by
 * `useRealtimeSync` on the DAILY_TASK scope.
 */
export function useDailyLoveTask(todayKey: string): DailyLoveTaskView {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const queryClient = useQueryClient();
  const queryKey = queryKeys.dailyLoveTask.today(todayKey);

  const [local, setLocal] = useState<LocalState>(() => readLocalState(todayKey));

  const query = useQuery({
    queryKey,
    queryFn: () => apiFetch<DailyLoveTaskState>("/api/daily-task"),
    enabled: authenticated,
    staleTime: 30_000,
  });

  const applyLocal = useCallback((next: LocalState) => {
    setLocal(next);
    writeLocalState(next);
  }, []);

  const mutation = useMutation({
    mutationFn: (input: { task: string; done: boolean }) =>
      apiFetch<DailyLoveTaskState>("/api/daily-task", {
        method: "PUT",
        body: JSON.stringify({ date: todayKey, task: input.task, done: input.done }),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DailyLoveTaskState>(queryKey);
      if (previous) {
        const doneChanged = previous.done !== input.done;
        queryClient.setQueryData<DailyLoveTaskState>(queryKey, {
          ...previous,
          date: todayKey,
          task: input.task,
          done: input.done,
          streak: doneChanged
            ? Math.max(previous.streak + (input.done ? 1 : -1), 0)
            : previous.streak,
          history: withHistory(previous.history, input.task, todayKey, input.done),
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan tugas. Coba lagi.";
      toast.error(message);
      // A 409 means the server moved to a new Jakarta day; pull the fresh state.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyLoveTask.all });
    },
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
    },
  });

  const { mutate, isPending } = mutation;
  // Writes wait for the first server read: otherwise a tap during the initial
  // fetch would PUT the rotation default over a task chosen on another device.
  const serverReady = query.data !== undefined;

  const base: DailyLoveTaskState = authenticated
    ? (query.data ?? fallbackState(todayKey))
    : status === "unauthenticated"
      ? local
      : fallbackState(todayKey);

  const toggleDone = useCallback(() => {
    if (authenticated) {
      if (isPending || !serverReady) return;
      mutate({ task: base.task, done: !base.done });
      return;
    }
    if (status !== "unauthenticated") return;

    const done = !base.done;
    applyLocal({
      date: todayKey,
      task: base.task,
      done,
      streak: Math.max(base.streak + (done ? 1 : -1), 0),
      history: withHistory(base.history, base.task, todayKey, done),
    });
  }, [applyLocal, authenticated, base, isPending, mutate, serverReady, status, todayKey]);

  const nextTask = useCallback(() => {
    if (authenticated && (isPending || !serverReady)) return;
    if (status !== "authenticated" && status !== "unauthenticated") return;

    const task = pickNextLoveTask(base.task, base.history);
    if (authenticated) {
      mutate({ task, done: false });
      return;
    }

    applyLocal({
      date: todayKey,
      task,
      done: false,
      streak: base.done ? Math.max(base.streak - 1, 0) : base.streak,
      history: withHistory(base.history, base.task, todayKey, false),
    });
  }, [applyLocal, authenticated, base, isPending, mutate, serverReady, status, todayKey]);

  const syncState: DailyLoveTaskSyncState = authenticated
    ? query.isError
      ? "error"
      : query.isPending
        ? "syncing"
        : "synced"
    : status === "loading"
      ? "syncing"
      : "guest";

  return {
    ...base,
    saving: authenticated && isPending,
    syncState,
    toggleDone,
    nextTask,
  };
}
