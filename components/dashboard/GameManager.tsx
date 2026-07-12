"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Loader2, X, Shuffle, Brain, Cherry, Sparkles, Trash2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import { formatInJakarta } from "@/lib/date";
import type { GameType } from "@/types";

const GAME_TYPES: { value: GameType; label: string; icon: typeof Shuffle }[] = [
  { value: "WOULD_YOU_RATHER", label: "Would You Rather?", icon: Shuffle },
  { value: "TRIVIA", label: "Love Quiz", icon: Brain },
  { value: "SPIN_THE_WHEEL", label: "Spin The Wheel", icon: Cherry },
  { value: "TRUTH_OR_DARE", label: "Truth or Dare", icon: Sparkles },
];

type Question = {
  id: string;
  type: GameType;
  question: string;
  optionA: string | null;
  optionB: string | null;
  answer: string | null;
  category: string | null;
  createdAt: string;
};

export default function GameManager() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<GameType>("WOULD_YOU_RATHER");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<GameType>("WOULD_YOU_RATHER");
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const { data: allQuestions, isLoading } = useQuery({
    queryKey: ["games", "questions", "all", sortOrder],
    queryFn: async () => {
      const res = await fetch(`/api/games/questions?limit=2000&sort=${sortOrder}`, {
        cache: "no-cache",
      });
      const json = await res.json();
      return json.data as Question[];
    },
    staleTime: 30_000,
  });

  const questions = useMemo(
    () => allQuestions?.filter((q) => q.type === activeTab) ?? [],
    [allQuestions, activeTab],
  );

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!allQuestions) return counts;
    for (const q of allQuestions) {
      counts[q.type] = (counts[q.type] || 0) + 1;
    }
    return counts;
  }, [allQuestions]);

  const createQuestion = useMutation({
    mutationFn: async (data: {
      type: GameType;
      question: string;
      optionA?: string;
      optionB?: string;
      answer?: string;
      category?: string;
    }) => {
      const res = await fetch("/api/games/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat pertanyaan");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games", "questions"], refetchType: "all" });
      toast.success("Pertanyaan ditambahkan! 🎯");
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setAnswer("");
      setCategory("");
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal"),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/games/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus pertanyaan");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games", "questions"], refetchType: "all" });
      toast.success("Pertanyaan dihapus");
    },
    onError: () => toast.error("Gagal menghapus pertanyaan"),
  });

  const editQuestion = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        type?: GameType;
        question?: string;
        optionA?: string | null;
        optionB?: string | null;
        answer?: string | null;
        category?: string | null;
      };
    }) => {
      const res = await fetch(`/api/games/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah pertanyaan");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["games", "questions"], refetchType: "all" });
      toast.success("Pertanyaan diubah! ✏️");
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setAnswer("");
      setCategory("");
      setType(activeTab);
      setEditingId(null);
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Gagal"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) {
      toast.error("Pertanyaan wajib diisi");
      return;
    }
    if (type === "WOULD_YOU_RATHER" && (!optionA.trim() || !optionB.trim())) {
      toast.error("Kedua opsi wajib diisi");
      return;
    }
    if (isTOD && !category.trim()) {
      toast.error("Kategori (Truth/Dare) wajib dipilih");
      return;
    }

    if (editingId) {
      editQuestion.mutate({
        id: editingId,
        data: {
          type,
          question: question.trim(),
          optionA: optionA.trim() || null,
          optionB: optionB.trim() || null,
          answer: answer.trim() || null,
          category: category.trim() || null,
        },
      });
    } else {
      createQuestion.mutate({
        type,
        question: question.trim(),
        optionA: optionA.trim() || undefined,
        optionB: optionB.trim() || undefined,
        answer: answer.trim() || undefined,
        category: category.trim() || undefined,
      });
    }
  }

  function startEditing(q: Question) {
    setEditingId(q.id);
    setType(q.type);
    setActiveTab(q.type);
    setQuestion(q.question);
    setOptionA(q.optionA ?? "");
    setOptionB(q.optionB ?? "");
    setAnswer(q.answer ?? "");
    setCategory(q.category ?? "");
    setOpen(true);
    setExpandedId(null);
  }

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setAnswer("");
    setCategory("");
    setType(activeTab);
    setOpen(false);
  }, [activeTab]);

  function startNew() {
    setEditingId(null);
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setAnswer("");
    setCategory("");
    setType(activeTab);
    setOpen(true);
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) cancelEdit();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, cancelEdit]);

  const isWYR = type === "WOULD_YOU_RATHER";
  const isTOD = type === "TRUTH_OR_DARE";
  const isEditing = !!editingId;

  return (
    <div className="w-full max-w-full space-y-6 overflow-hidden">
      <div className="flex flex-wrap gap-1.5">
        {GAME_TYPES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              activeTab === value
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs sm:text-sm">{label}</span>
            <span className="shrink-0 rounded-full bg-muted-foreground/10 px-1.5 text-[10px] tabular-nums">
              {countByType[value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-medium">
          Pertanyaan {GAME_TYPES.find((t) => t.value === activeTab)?.label}
        </h3>
        <div className="flex flex-row items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-sm transition-colors"
          >
            {sortOrder === "desc" ? "Terbaru ↓" : "Terlama ↑"}
          </button>
          <Button size="sm" onClick={startNew} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) cancelEdit(); }}
        >
          <div className="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold sm:text-lg">{isEditing ? "Edit Pertanyaan" : "Pertanyaan Baru"}</h2>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full p-1 transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">

              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const gt = GAME_TYPES.find((t) => t.value === type);
                    if (!gt) return null;
                    const Icon = gt.icon;
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                        <Icon className="h-3 w-3" />
                        {gt.label}
                      </span>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {GAME_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        type === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Pertanyaan..."
                className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />

              {isWYR && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      value={optionA}
                      onChange={(e) => setOptionA(e.target.value)}
                      placeholder="Opsi A"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    />
                    <input
                      value={optionB}
                      onChange={(e) => setOptionB(e.target.value)}
                      placeholder="Opsi B"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Jawaban Benar (opsional):</p>
                    <div className="flex gap-2">
                      {(["A", "B", "none"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswer(opt === "none" ? "" : opt)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            (opt === "none" ? !answer : answer === opt)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                        >
                          {opt === "A" ? "Opsi A" : opt === "B" ? "Opsi B" : "Tidak Ada"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {type === "TRIVIA" && (
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Jawaban (atau 'None' untuk diskusi)"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}

              {isTOD ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Kategori *</p>
                  <div className="flex gap-2">
                    {["Truth", "Dare"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                          category === cat
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {cat === "Truth" ? "😇 Truth" : "😈 Dare"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Kategori (opsional)"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}

              <Button
                type="submit"
                disabled={(editingId ? editQuestion.isPending : createQuestion.isPending) || !question.trim()}
                className="w-full gap-2"
              >
                {(editingId ? editQuestion.isPending : createQuestion.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isEditing ? "Simpan" : "Tambahkan"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : !questions || questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada pertanyaan untuk tipe ini
          </p>
        </div>
      ) : (
        <div className="w-full max-w-full space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="w-full max-w-full overflow-hidden rounded-xl border border-border bg-card transition-colors"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setExpandedId(expandedId === q.id ? null : q.id)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(expandedId === q.id ? null : q.id);
                  }
                }}
                className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 text-left sm:gap-3 sm:px-4 sm:py-3"
              >
                <div className="min-w-0 overflow-hidden">
                  <p className="truncate text-sm font-medium">
                    {q.question}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {q.category ?? "Tanpa kategori"} · {formatInJakarta(q.createdAt, { dateStyle: "medium" })}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(q);
                    }}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label="Edit pertanyaan"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await showDeleteConfirm({
                        title: "Hapus Pertanyaan",
                        text: "Apakah Anda yakin ingin menghapus pertanyaan ini?",
                      });
                      if (confirmed) {
                        deleteQuestion.mutate(q.id);
                      }
                    }}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Hapus pertanyaan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expandedId === q.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedId === q.id && (
                <div className="border-t border-border px-3 py-2.5 space-y-1.5 sm:px-4 sm:py-3">
                  {q.optionA && (
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">A:</span> {q.optionA}
                    </p>
                  )}
                  {q.optionB && (
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">B:</span> {q.optionB}
                    </p>
                  )}
                  {q.answer && q.type === "WOULD_YOU_RATHER" && (
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Jawaban:</span>{" "}
                      {q.answer === "A" ? q.optionA : q.answer === "B" ? q.optionB : q.answer}
                      {q.answer === "A" && " (Opsi A)"}
                      {q.answer === "B" && " (Opsi B)"}
                    </p>
                  )}
                  {q.answer && q.type !== "WOULD_YOU_RATHER" && (
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Jawaban:</span> {q.answer}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
