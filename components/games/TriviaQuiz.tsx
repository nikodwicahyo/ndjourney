"use client";

import { useState, useEffect } from "react";
import { useAllQuestions, useSubmitScore, type GameQuestionWithMeta } from "@/hooks/useGames";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Brain, RefreshCw, Check, X, ArrowRight } from "lucide-react";

const BATCH_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type TriviaQuizProps = {
  disableScoreSubmit?: boolean;
  playerName?: string;
};

export default function TriviaQuiz({ disableScoreSubmit = false, playerName }: TriviaQuizProps) {
  const { data: allQuestions, isLoading, error, refetch } = useAllQuestions("TRIVIA");
  const submitScore = useSubmitScore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Array<{ question: string; correct: boolean }>>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<GameQuestionWithMeta[]>([]);
  const [batchNum, setBatchNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const totalSeen = seenIds.size;

  useEffect(() => {
    if (allQuestions && allQuestions.length > 0 && batch.length === 0) {
      const next = shuffle(allQuestions).slice(0, BATCH_SIZE);
      setBatch(next);
      setHasMore(allQuestions.length > BATCH_SIZE);
    }
  }, [allQuestions, batch]);

  const isLoadingState = isLoading || (!allQuestions && batch.length === 0);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && userAnswer.trim() && !revealed) {
      revealAnswer();
    }
  }

  if (isLoadingState) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error || !allQuestions || allQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Belum ada pertanyaan</p>
        <Button onClick={() => refetch()}>Muat Ulang</Button>
      </div>
    );
  }

  const current = batch[currentIdx];

  if (!current || finished) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
        >
          <Brain className="h-10 w-10 text-primary" />
        </motion.div>
        <div>
          <p className="font-heading text-xl font-semibold">
            Batch {batchNum} Selesai! 🎯
          </p>
          <p className="mt-2 text-muted-foreground">
            Skor: {score}/{batch.length}
            {allQuestions.length > 0 && (
              <> &middot; Total {totalSeen + batch.length}/{allQuestions.length} terjawab</>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {score === batch.length
              ? "Sempurna! Kamu benar-benar kenal pasanganmu! 💕"
              : score >= batch.length / 2
                ? "Lumayan! Masih ada ruang untuk tahu lebih banyak 😊"
                : "Yuk kenali pasanganmu lebih dalam lagi! 💪"}
          </p>
        </div>
        <div className="flex gap-3">
          {hasMore && (
            <Button onClick={continueToNext} className="gap-2">
              Lanjutkan
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={hasMore ? "outline" : "default"}
            onClick={mainLagi}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {hasMore ? "Mulai Ulang" : "Main Lagi"}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="mt-4 w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hasil
            </p>
            {results.map((r, i) => (
              <p key={i} className="flex items-center gap-2 text-sm">
                {r.correct ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                {r.question}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function revealAnswer() {
    setRevealed(true);
    const isCorrect =
      current.answer?.toLowerCase() === "none" ||
      userAnswer.toLowerCase().trim() === current.answer?.toLowerCase().trim();

    if (isCorrect) setScore((s) => s + 1);

    setResults((prev) => [
      ...prev,
      { question: current.question, correct: isCorrect },
    ]);

    if (!disableScoreSubmit) {
      try {
        await submitScore.mutateAsync({
          questionId: current.id,
          isCorrect,
          playerName,
        });
      } catch {
        // silent
      }
    }
  }

  function next() {
    if (!batch) return;
    if (currentIdx < batch.length - 1) {
      setCurrentIdx((i) => i + 1);
      setUserAnswer("");
      setRevealed(false);
    } else {
      finishBatch();
    }
  }

  function finishBatch() {
    const updatedSeen = new Set(seenIds);
    batch.forEach(q => updatedSeen.add(q.id));
    setSeenIds(updatedSeen);

    const remaining = allQuestions!.filter(q => !updatedSeen.has(q.id));
    setHasMore(remaining.length > 0);
    setFinished(true);
  }

  function continueToNext() {
    const updatedSeen = new Set(seenIds);
    const remaining = allQuestions!.filter(q => !updatedSeen.has(q.id));

    let nextBatch: GameQuestionWithMeta[];
    let more: boolean;

    if (remaining.length === 0) {
      nextBatch = shuffle(allQuestions!).slice(0, BATCH_SIZE);
      more = allQuestions!.length > BATCH_SIZE;
      setBatchNum(1);
      setSeenIds(new Set());
    } else {
      nextBatch = remaining.length > BATCH_SIZE
        ? shuffle(remaining).slice(0, BATCH_SIZE)
        : shuffle(remaining);
      more = remaining.length > BATCH_SIZE;
      setBatchNum(n => n + 1);
    }

    setBatch(nextBatch);
    setHasMore(more);
    setCurrentIdx(0);
    setUserAnswer("");
    setRevealed(false);
    setScore(0);
    setFinished(false);
    setResults([]);
  }

  function mainLagi() {
    const next = shuffle(allQuestions!).slice(0, BATCH_SIZE);
    setBatch(next);
    setHasMore(allQuestions!.length > BATCH_SIZE);
    setSeenIds(new Set());
    setBatchNum(1);
    setCurrentIdx(0);
    setUserAnswer("");
    setRevealed(false);
    setScore(0);
    setFinished(false);
    setResults([]);
  }

  function acakUlang() {
    const reshuffled = shuffle(batch);
    setBatch(reshuffled);
    setCurrentIdx(0);
    setUserAnswer("");
    setRevealed(false);
    setScore(0);
    setFinished(false);
    setResults([]);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Batch {batchNum} &middot; {currentIdx + 1}/{batch.length}
        </span>
        <button
          onClick={acakUlang}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Acak Ulang
        </button>
      </div>

      <motion.div
        key={currentIdx}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8 text-center"
      >
        <div className="mb-2 flex justify-center">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-heading text-xl font-semibold">
          {current.question}
        </h2>
        {current.category && (
          <p className="mt-1 text-xs text-muted-foreground">
            {current.category}
          </p>
        )}
      </motion.div>

      {!revealed ? (
        <div className="space-y-4">
          <input
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ketik jawabanmu..."
            className="flex h-12 w-full rounded-xl border border-input bg-background px-4 text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <Button
            className="w-full"
            disabled={!userAnswer.trim()}
            onClick={revealAnswer}
          >
            Lihat Jawaban
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <div
            className={`rounded-2xl border-2 p-6 ${
              current.answer?.toLowerCase() === "none"
                ? "border-green-500/30 bg-green-500/5"
                : userAnswer.toLowerCase().trim() === current.answer?.toLowerCase().trim()
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <p className="text-sm text-muted-foreground">Jawaban kamu:</p>
            <p className="mt-1 font-medium">{userAnswer}</p>
            {current.answer?.toLowerCase() !== "none" && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">Jawaban sebenarnya:</p>
                <p className="mt-1 font-medium text-primary">{current.answer}</p>
              </>
            )}
            {current.answer?.toLowerCase() === "none" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Tidak ada jawaban benar — diskusikan dengan pasanganmu!
              </p>
            )}
          </div>

          <Button onClick={next} className="gap-2">
            {currentIdx < batch.length - 1 ? "Selanjutnya" : "Lihat Skor"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
