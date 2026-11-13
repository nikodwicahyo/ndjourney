"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  AlertCircle,
  Check,
  Cloud,
  HardDrive,
  Heart,
  Loader2,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useJakartaToday } from "@/hooks/useJakartaToday";
import {
  useDailyLoveTask,
  type DailyLoveTaskSyncState,
} from "@/hooks/useDailyLoveTask";
import {
  formatLoveTaskDayLabel,
  formatLoveTaskHistoryDate,
} from "@/lib/daily-love-task";

// The list is a preview of the newest entries; the full set stays in state so
// the picker still knows every completed task.
const HISTORY_PREVIEW_LIMIT = 20;

function SyncNote({ syncState }: { syncState: DailyLoveTaskSyncState }) {
  const base = "flex items-center gap-1 text-[10px] sm:text-[11px]";
  if (syncState === "syncing") {
    return (
      <span className={`${base} text-muted-foreground`}>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Menyinkronkan...
      </span>
    );
  }
  if (syncState === "error") {
    return (
      <span className={`${base} text-destructive`}>
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Belum tersinkron
      </span>
    );
  }
  if (syncState === "synced") {
    return (
      <span className={`${base} text-muted-foreground`}>
        <Cloud className="h-3 w-3" aria-hidden="true" />
        Tersinkron antar perangkat
      </span>
    );
  }
  return (
    <span className={`${base} text-muted-foreground`}>
      <HardDrive className="h-3 w-3" aria-hidden="true" />
      Tersimpan di perangkat ini
    </span>
  );
}

function DailyLoveTaskInner({ today }: { today: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { task, done, streak, history, saving, syncState, toggleDone, nextTask } =
    useDailyLoveTask(today);

  const handleDone = () => {
    const wasDone = done;
    toggleDone();
    if (!wasDone) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      role="region"
      aria-labelledby="daily-love-task-title"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6"
    >
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{
                x: "50%",
                y: "100%",
                opacity: 1,
                scale: 0,
              }}
              animate={{
                x: `${20 + ((i * 37) % 60)}%`,
                y: `${-10 + ((i * 53) % 60) * -1}%`,
                opacity: 0,
                scale: 1 + ((i * 29) % 10) / 10,
                rotate: (i * 47) % 360,
              }}
              transition={{ duration: 1 + ((i * 13) % 10) / 10, ease: "easeOut" }}
              className="absolute text-lg"
              style={{ bottom: 0 }}
            >
              {["🌸", "✨", "💖", "🌟", "🎉", "💫", "🌺", "⭐"][i % 8]}
            </motion.span>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="daily-love-task-title"
              className="truncate text-sm font-semibold sm:text-base"
            >
              Daily Love Task
            </h2>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              {formatLoveTaskDayLabel(today)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary sm:text-xs"
            >
              <PartyPopper className="h-3 w-3" aria-hidden="true" />
              {streak} hari
            </motion.div>
          )}
          <button
            type="button"
            onClick={nextTask}
            disabled={saving}
            className="flex min-h-11 items-center gap-1 rounded-full px-3 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9 sm:text-xs"
            aria-label="Ganti tugas hari ini"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Ganti tugas
          </button>
        </div>
      </div>

      <motion.div
        className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-primary/[0.01] p-4 sm:p-5"
        animate={done ? { scale: [1, 1.01, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Heart
              className={done ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4 text-primary"}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
              Tugas hari ini
            </p>
            <p
              className={`mt-1 break-words text-sm leading-relaxed sm:text-base ${
                done ? "text-muted-foreground" : "font-medium text-foreground"
              }`}
            >
              {done ? (
                <span className="line-through decoration-primary/40">{task}</span>
              ) : (
                task
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleDone}
            disabled={saving}
            aria-pressed={done}
            aria-busy={saving}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
              done
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : done ? (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Batalkan
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Tandai selesai
              </>
            )}
          </motion.button>

          <span aria-live="polite" className="min-h-4">
            {done && !saving && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-start"
              >
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                Great job!
              </motion.span>
            )}
          </span>
        </div>
      </motion.div>

      <section className="mt-4 border-t border-border pt-4" aria-label="Riwayat tugas selesai">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground sm:text-sm">
              Riwayat selesai
            </h3>
            {history.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground sm:text-[11px]">
                {history.length}
              </span>
            )}
          </div>
          <SyncNote syncState={syncState} />
        </div>

        {history.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground sm:text-xs">
            Belum ada riwayat. Selesaikan tugas pertama hari ini.
          </p>
        ) : (
          <>
            <ol className="mt-2 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
              {history.slice(0, showAllHistory ? history.length : HISTORY_PREVIEW_LIMIT).map((entry, i) => (
                <li
                  key={`${entry.task}-${entry.date}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className="min-w-0 flex-1 truncate text-xs text-muted-foreground line-through decoration-muted-foreground/50"
                    title={entry.task}
                  >
                    {entry.task}
                  </span>
                  {entry.date && (
                    <time
                      dateTime={entry.date}
                      className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70 sm:text-[11px]"
                    >
                      {formatLoveTaskHistoryDate(entry.date, today)}
                    </time>
                  )}
                </li>
              ))}
            </ol>
            {history.length > HISTORY_PREVIEW_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllHistory((value) => !value)}
                aria-expanded={showAllHistory}
                className="mt-2 inline-flex min-h-11 items-center rounded-md text-[11px] font-medium tabular-nums text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:text-xs"
              >
                {showAllHistory
                  ? "Tampilkan lebih sedikit"
                  : `+${history.length - HISTORY_PREVIEW_LIMIT} lainnya`}
              </button>
            )}
          </>
        )}
      </section>
    </motion.div>
  );
}

// Remount at Jakarta midnight so the new day's task, completion, and streak
// load fresh from the server (or the guest store) instead of lingering.
export default function DailyLoveTask() {
  const today = useJakartaToday();
  return <DailyLoveTaskInner key={today} today={today} />;
}
