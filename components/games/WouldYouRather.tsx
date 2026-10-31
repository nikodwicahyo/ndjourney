"use client";

import { useState, useRef, useEffect } from "react";
import { useQuestionDeck, useSubmitScore, useSubmitGameRound } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Shuffle, RefreshCw, Check, X } from "lucide-react";

const BATCH_SIZE = 10;

type WouldYouRatherProps = {
  playerName?: string;
  onExit?: () => void;
};

type PickKey = "A" | "B";

export default function WouldYouRather({ playerName, onExit }: WouldYouRatherProps) {
  const deck = useQuestionDeck("WOULD_YOU_RATHER", BATCH_SIZE);
  const { isLoading, error, refetch } = deck;
  const submitScore = useSubmitScore();
  const submitRound = useSubmitGameRound();
  // One id per completed round — the server uses it to make retries idempotent.
  const [roundId, setRoundId] = useState(() => crypto.randomUUID());
  const submittedRoundRef = useRef<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [picked, setPicked] = useState<PickKey | null>(null);
  // Graded server-side: the answer key is not part of the public payload.
  const [reveal, setReveal] = useState<{ correct: boolean; answer: string | null } | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState<Array<{ question: string; choice: string; correct: boolean }>>([]);
  // Reveal auto-advance must not fire after unmount (back navigation).
  const pickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (pickTimeoutRef.current) clearTimeout(pickTimeoutRef.current);
    };
  }, []);

  // Record the completed round exactly once. This is the event the leaderboard
  // counts — quitting mid-round deliberately does not count.
  useEffect(() => {
    if (!finished || submittedRoundRef.current === roundId) return;
    submittedRoundRef.current = roundId;
    void submitRound
      .mutateAsync({
        gameType: "WOULD_YOU_RATHER",
        roundId,
        questionIds: deck.batch.map((q) => q.id),
        playerName,
      })
      .catch(() => {
        // Silent: the round result stays on screen; the score POST already
        // recorded every answer and a later round will refresh the board.
      });
  }, [finished, roundId, deck.batch, playerName, submitRound]);

  const batch = deck.batch;
  const totalQuestions = deck.total;
  const current = batch[currentIdx];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Gagal memuat pertanyaan</p>
        <Button onClick={() => refetch()}>Coba Lagi</Button>
      </div>
    );
  }

  if (!batch || batch.length === 0) {
    if (totalQuestions > 0) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Belum ada pertanyaan</p>
        <Button onClick={() => refetch()}>Muat Ulang</Button>
      </div>
    );
  }

  if (!current || finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <Check className="h-10 w-10 text-primary" aria-hidden="true" />
        </motion.div>
        <div>
          <p className="font-heading text-xl font-semibold">Selesai! 🎉</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Skor: {score}/{batch.length}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" onClick={putaranBaru} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Main Lagi
          </Button>
          <Button type="button" variant="outline" onClick={() => onExit?.()} className="gap-2">
            Keluar
          </Button>
        </div>
        {history.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Riwayat Pilihan
            </p>
            {history.map((h, i) => (
              <p key={i} className="text-sm">
                <span className="text-muted-foreground">{i + 1}.</span> {h.question}
                <br />
                <span className="ml-4 inline-flex items-center gap-1 text-xs">
                  {h.correct ? (
                    <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                  ) : (
                    <X className="h-3 w-3 text-red-500" aria-hidden="true" />
                  )}
                  → {h.choice}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function pick(key: PickKey, label: string) {
    if (!current || picked) return;
    setPicked(key);
    // Persist the answered id before the network trip: quitting mid-round must
    // still exclude this question on the next mount.
    deck.markAnswered(current.id);

    // SEC: server grades the choice; never trust (or ship) `isCorrect`.
    let result: { correct: boolean; answer: string | null } = {
      correct: false,
      answer: null,
    };
    try {
      const res = await submitScore.mutateAsync({
        questionId: current.id,
        selectedAnswer: key,
        playerName,
      });
      result = { correct: res.correct, answer: res.answer };
    } catch {
      // Network/validation failure: neutral result, never a silent pass.
    }

    setReveal(result);
    if (result.correct) setScore((s) => s + 1);

    setHistory((prev) => [
      ...prev,
      { question: current.question, choice: label, correct: result.correct },
    ]);
    pickTimeoutRef.current = setTimeout(() => {
      if (currentIdx < batch.length - 1) {
        setCurrentIdx((i) => i + 1);
        setPicked(null);
        setReveal(null);
      } else {
        setFinished(true);
      }
    }, 1500);
  }

  // Fresh round from unseen questions — the deck key change auto-fetches,
  // so no manual refetch to race it. Used by both Main Lagi and Acak Ulang.
  function putaranBaru() {
    const ids = batch?.map((q) => q.id) ?? [];
    if (ids.length === 0 && !finished) return;
    if (pickTimeoutRef.current) clearTimeout(pickTimeoutRef.current);
    setFinished(false);
    setScore(0);
    setCurrentIdx(0);
    setHistory([]);
    setPicked(null);
    setReveal(null);
    setRoundId(crypto.randomUUID());
    deck.restart(ids);
  }

  const hasCorrectAnswer = reveal?.answer === "A" || reveal?.answer === "B";

  function optionStyle(key: PickKey) {
    if (!picked) return "border-border bg-card hover:border-primary/50 hover:shadow-sm";
    const chosen = picked === key;
    const correct = reveal?.answer === key;
    if (chosen && correct) return "border-green-500 bg-green-500/10";
    if (chosen && !correct) return "border-red-500 bg-red-500/10";
    if (!chosen && correct && hasCorrectAnswer) return "border-green-500/50 bg-green-500/5";
    return "border-border opacity-50";
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {currentIdx + 1}/{batch.length}
          <span className="ml-2 text-xs text-muted-foreground/60">
            &middot; dari {totalQuestions} pertanyaan
          </span>
          <span className="ml-2 text-xs">
            &middot; Benar: {score}
          </span>
        </span>
        <button
          type="button"
          onClick={putaranBaru}
          className="inline-flex min-h-11 items-center gap-1 px-2 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Acak Ulang
        </button>
      </div>

      <motion.div
        key={current.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8 text-center"
      >
        <div className="mb-2 flex justify-center">
          <Shuffle className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {current.question}
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        {([
          { key: "A" as const, label: current.optionA || "Opsi A" },
          { key: "B" as const, label: current.optionB || "Opsi B" },
        ]).map((opt) => {
          const isCorrect = reveal?.answer === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => void pick(opt.key, opt.label)}
              disabled={!!picked}
              aria-label={picked && hasCorrectAnswer && isCorrect ? `${opt.label} — Benar` : opt.label}
              className={`relative rounded-2xl border-2 p-6 text-center font-medium transition-all ${optionStyle(opt.key)}`}
            >
              {opt.label}
              {picked && hasCorrectAnswer && isCorrect && (
                <span className="mt-1 block text-xs font-semibold text-green-600">
                  {picked === opt.key ? "✓ Benar" : "Benar"}
                </span>
              )}
              {picked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2"
                >
                  {picked === opt.key ? (
                    reveal ? (
                      reveal.correct ? (
                        <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" aria-hidden="true" />
                      )
                    ) : null
                  ) : hasCorrectAnswer && isCorrect ? (
                    <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
                  ) : null}
                </motion.div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
