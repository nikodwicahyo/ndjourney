"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateLetter, usePartner } from "@/hooks/useLetters";
import { useLetterDraft } from "@/hooks/useLetterDraft";
import { loadLetterDraft } from "@/lib/letter-draft";
import { Button, Skeleton } from "@/components/ui";
import LetterEditor from "./LetterEditor";
import { LETTER_MOOD_CONFIG } from "@/types";
import {
  X,
  Loader2,
  Lock,
  Sparkles,
  Heart,
  History,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import type { LetterMood } from "@/types";
import {
  formatInJakarta,
  getJakartaParts,
  getJakartaToday,
  parseJakartaDateTime,
} from "@/lib/date";
import { stripHtml } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";

const MOODS = Object.entries(LETTER_MOOD_CONFIG) as [
  LetterMood,
  { emoji: string; label: string; color: string },
][];

const DEFAULT_UNLOCK_TIME = "00:00";

function formatDraftTime(timestamp: number): string {
  const parts = getJakartaParts(new Date(timestamp));
  if (!parts) return "";
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function formatUnlockMoment(date: Date): string {
  const day = formatInJakarta(date, { dateStyle: "long" });
  const parts = getJakartaParts(date);
  if (!parts) return day;
  return `${day} pukul ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export default function NewLetterForm({
  userId,
  onClose,
}: {
  userId: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const createLetter = useCreateLetter();
  const { data: partner, isLoading: partnerLoading, isError: partnerError } = usePartner();

  // Read the draft once, before the first paint, so a restored letter never
  // flashes an empty editor. The loader renders this form client-only.
  const [draft] = useState(() => loadLetterDraft(userId));
  const [title, setTitle] = useState(draft?.title ?? "");
  const [content, setContent] = useState(draft?.content || "<p></p>");
  const [mood, setMood] = useState<LetterMood>(draft?.mood ?? "LOVE");
  const [isTimeCapsule, setIsTimeCapsule] = useState(draft?.isTimeCapsule ?? false);
  const [unlockDate, setUnlockDate] = useState(draft?.unlockDate ?? "");
  const [unlockTime, setUnlockTime] = useState(
    draft?.unlockTime || DEFAULT_UNLOCK_TIME,
  );
  const [restoredAt, setRestoredAt] = useState(draft?.savedAt ?? null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [contentEdited, setContentEdited] = useState(
    () => !!draft && !!stripHtml(draft.content),
  );
  const [loading, setLoading] = useState(false);

  const { savedAt, saveFailed, discard, clear } = useLetterDraft(userId, {
    title,
    content,
    mood,
    isTimeCapsule,
    unlockDate,
    unlockTime,
  });

  const plainText = stripHtml(content);
  const contentEmpty = !plainText;
  const wordCount = plainText ? plainText.split(" ").length : 0;
  const showTitleError = titleTouched && !title.trim();
  const showContentError = contentEdited && contentEmpty;

  const unlockAt =
    isTimeCapsule && unlockDate ? parseJakartaDateTime(unlockDate, unlockTime) : null;
  const unlockValid = !!unlockAt && unlockAt.getTime() > Date.now();
  const showUnlockError = isTimeCapsule && !!unlockDate && !unlockValid;

  // Same rules as handleSubmit: the button stays disabled until the letter can
  // actually be sent.
  const formValid =
    !!title.trim() && !contentEmpty && !!partner && (!isTimeCapsule || unlockValid);

  function handleContentChange(html: string) {
    setContent(html);
    if (stripHtml(html)) setContentEdited(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!title.trim()) {
      setTitleTouched(true);
      toast.error("Judul surat wajib diisi");
      return;
    }
    if (contentEmpty) {
      setContentEdited(true);
      toast.error("Konten surat wajib diisi");
      return;
    }
    if (!partner) {
      toast.error("Data pasangan tidak ditemukan");
      return;
    }
    if (isTimeCapsule && !unlockDate) {
      toast.error("Pilih tanggal pembukaan time capsule");
      return;
    }
    if (isTimeCapsule && !unlockValid) {
      toast.error("Tanggal pembukaan harus di masa depan");
      return;
    }

    setLoading(true);
    try {
      await createLetter.mutateAsync({
        title: title.trim(),
        content,
        recipientId: partner.id,
        mood,
        isTimeCapsule,
        unlockAt: isTimeCapsule && unlockAt ? unlockAt.toISOString() : null,
      });
      clear();
      toast.success("Surat terkirim!");
      if (onClose) onClose();
      else router.push("/dashboard/letters");
    } catch {
      toast.error("Gagal mengirim surat");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    // Autosave already kept the letter; leaving is safe.
    if (onClose) onClose();
    else router.push("/dashboard/letters");
  }

  async function handleDiscard() {
    const confirmed = await showDeleteConfirm({
      title: "Mulai surat baru?",
      text: "Draft yang tersimpan akan dihapus dan formulir dikosongkan.",
      confirmText: "Ya, mulai baru",
    });
    if (!confirmed) return;

    discard();
    setRestoredAt(null);
    setTitle("");
    setContent("<p></p>");
    setMood("LOVE");
    setIsTimeCapsule(false);
    setUnlockDate("");
    setUnlockTime(DEFAULT_UNLOCK_TIME);
    setTitleTouched(false);
    setContentEdited(false);
  }

  if (partnerLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (partnerError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Terjadi kesalahan saat memuat data pasangan. Silakan coba lagi.</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Pasangan tidak ditemukan</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {onClose && (
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Tulis Surat</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-1 transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {restoredAt !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm">
              <span className="font-medium">Draft dipulihkan</span>
              <span className="text-muted-foreground">
                {" · terakhir disimpan "}
                {formatDraftTime(restoredAt)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
          >
            Mulai baru
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        {partner.image ? (
          <Image
            src={partner.image}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Untuk</p>
          <p className="truncate text-sm font-medium">{partner.name || "Pasangan"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="letter-title" className="text-sm font-medium">
            Judul <span aria-hidden="true">*</span>
          </label>
          <span className="text-xs tabular-nums text-muted-foreground">{title.length}/200</span>
        </div>
        <input
          id="letter-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTitleTouched(true)}
          placeholder="Contoh: Untuk kamu yang selalu ada"
          maxLength={200}
          autoFocus
          className="flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
          required
          aria-invalid={showTitleError}
          aria-describedby={showTitleError ? "letter-title-error" : "letter-title-hint"}
        />
        {showTitleError ? (
          <p id="letter-title-error" role="alert" className="text-xs text-destructive">
            Judul surat wajib diisi.
          </p>
        ) : (
          <p id="letter-title-hint" className="text-xs text-muted-foreground">
            Judul singkat yang bikin dia penasaran.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Suasana hati</p>
          <p className="text-xs text-muted-foreground">Pilih yang paling mendekati isi suratmu.</p>
        </div>
        <div role="group" aria-label="Suasana hati" className="flex flex-wrap gap-2">
          {MOODS.map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMood(key)}
              aria-pressed={mood === key}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all ${
                mood === key
                  ? "border-transparent shadow-sm"
                  : "border-border hover:bg-accent"
              }`}
              style={
                mood === key
                  ? { backgroundColor: config.color + "20", color: config.color, borderColor: config.color }
                  : undefined
              }
            >
              {config.emoji} {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">
            Isi Surat <span aria-hidden="true">*</span>
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {wordCount} kata · {plainText.length} karakter
          </span>
        </div>
        <LetterEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Mulai dengan “Hai sayang…” — lalu ceritakan apa yang ingin kamu sampaikan."
          ariaLabel="Isi surat"
          describedBy={showContentError ? "letter-content-error" : undefined}
        />
        {showContentError ? (
          <p id="letter-content-error" role="alert" className="text-xs text-destructive">
            Konten surat wajib diisi.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Gunakan toolbar untuk menebalkan, membuat daftar, atau mengutip.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={isTimeCapsule}
            onChange={(e) => setIsTimeCapsule(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Time Capsule
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Surat terkunci dan baru bisa dibuka pada tanggal yang kamu tentukan.
            </p>
          </div>
        </label>

        {isTimeCapsule ? (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="letter-unlock-date" className="text-xs font-medium text-muted-foreground">
                  Tanggal dibuka
                </label>
                <input
                  id="letter-unlock-date"
                  type="date"
                  value={unlockDate}
                  onChange={(e) => setUnlockDate(e.target.value)}
                  min={getJakartaToday()}
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-invalid={showUnlockError}
                  aria-describedby="letter-unlock-hint"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="letter-unlock-time" className="text-xs font-medium text-muted-foreground">
                  Jam
                </label>
                <input
                  id="letter-unlock-time"
                  type="time"
                  value={unlockTime}
                  onChange={(e) => setUnlockTime(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby="letter-unlock-hint"
                />
              </div>
            </div>
            {showUnlockError ? (
              <p id="letter-unlock-hint" role="alert" className="text-xs text-destructive">
                Tanggal pembukaan harus di masa depan.
              </p>
            ) : unlockValid && unlockAt ? (
              <p id="letter-unlock-hint" className="text-xs text-muted-foreground">
                Terbuka pada {formatUnlockMoment(unlockAt)}.
              </p>
            ) : (
              <p id="letter-unlock-hint" className="text-xs text-muted-foreground">
                Pilih tanggal dan jam kapan surat ini boleh dibuka.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <div className="space-y-3 border-t border-border pt-5">
        <p
          className={`text-xs ${saveFailed ? "text-destructive" : "text-muted-foreground"}`}
          role={saveFailed ? "alert" : undefined}
        >
          {saveFailed
            ? "Draft tidak bisa disimpan di perangkat ini. Jangan tutup halaman sebelum mengirim."
            : savedAt
              ? `Draft tersimpan otomatis · ${formatDraftTime(savedAt)}`
              : "Draft akan tersimpan otomatis."}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="gap-2 sm:flex-1"
            onClick={handleCancel}
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali
          </Button>
          <Button
            type="submit"
            variant="default"
            className="flex-1 gap-2"
            disabled={loading || !formValid}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mengirim...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Kirim Surat
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
