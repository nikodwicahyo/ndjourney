"use client";

import { useState, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateLetter, usePartner } from "@/hooks/useLetters";
import { Button, Skeleton } from "@/components/ui";
import { LETTER_MOOD_CONFIG } from "@/types";
import { X, Loader2, Clock, Lock, Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";
import type { LetterMood } from "@/types";
import { getJakartaToday, parseJakartaDateTime } from "@/lib/date";

const LetterEditor = dynamic(() => import("./LetterEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-input bg-muted/30">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

const MOODS = Object.entries(LETTER_MOOD_CONFIG) as [
  LetterMood,
  { emoji: string; label: string; color: string },
][];

export default function NewLetterForm({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const createLetter = useCreateLetter();
  const { data: partner, isLoading: partnerLoading, isError: partnerError } = usePartner();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("<p></p>");
  const [mood, setMood] = useState<LetterMood>("LOVE");
  const [isTimeCapsule, setIsTimeCapsule] = useState(false);
  const [unlockDate, setUnlockDate] = useState("");
  const [unlockTime, setUnlockTime] = useState("00:00");
  const [unlockError, setUnlockError] = useState("");
  const [loading, setLoading] = useState(false);

  // F-12: disable until valid (same rules as handleSubmit) — toasts stay as backup.
  const contentEmpty = !content.replace(/<[^>]*>/g, "").trim();
  const formValid =
    !!title.trim() && !contentEmpty && !!partner && (!isTimeCapsule || !!unlockDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Judul surat wajib diisi");
      return;
    }
    const plainText = content.replace(/<[^>]*>/g, "").trim();
    if (!plainText) {
      toast.error("Konten surat wajib diisi");
      return;
    }
    if (!partner) {
      toast.error("Data pasangan tidak ditemukan");
      return;
    }
    if (isTimeCapsule && !unlockDate) {
      setUnlockError("Pilih tanggal pembukaan time capsule");
      toast.error("Pilih tanggal pembukaan time capsule");
      return;
    }
    if (isTimeCapsule && unlockDate) {
      const check = parseJakartaDateTime(unlockDate, unlockTime);
      if (!check || check.getTime() <= Date.now()) {
        setUnlockError("Tanggal pembukaan harus di masa depan");
        toast.error("Tanggal pembukaan harus di masa depan");
        return;
      }
      setUnlockError("");
    }

    setLoading(true);

    let unlockAt: string | null = null;
    if (isTimeCapsule && unlockDate) {
      const d = parseJakartaDateTime(unlockDate, unlockTime);
      unlockAt = d ? d.toISOString() : null;
    }

    try {
      await createLetter.mutateAsync({
        title: title.trim(),
        content,
        recipientId: partner.id,
        mood,
        isTimeCapsule,
        unlockAt,
      });
      toast.success("Surat terkirim!");
      if (onClose) onClose();
      router.push("/dashboard/letters");
    } catch {
      toast.error("Gagal mengirim surat");
    } finally {
      setLoading(false);
    }
  }

  if (partnerLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
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
          <h2 className="font-heading text-lg font-semibold">
            Tulis Surat
          </h2>
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Untuk</p>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm">
          <span className="text-lg">{partner.image ? <Image src={partner.image} alt="" className="h-5 w-5 rounded-full" width={20} height={20} /> : <Heart className="h-5 w-5 fill-primary text-primary" />}</span>
          <span className="font-medium">{partner.name || "Pasangan"}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="letter-title" className="text-sm font-medium">Judul *</label>
          <span className="text-xs text-muted-foreground">{title.length}/200</span>
        </div>
        <input
          id="letter-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul surat..."
          maxLength={200}
          className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
          aria-invalid={!title.trim()}
          aria-describedby="letter-title-error"
        />
        {!title.trim() && (
          <p id="letter-title-error" role="alert" className="text-xs text-destructive">
            Judul surat wajib diisi
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mood</label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMood(key)}
              aria-pressed={mood === key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                mood === key
                  ? "border-transparent ring-2 ring-offset-1"
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
        <label className="text-sm font-medium">
          Isi Surat <span className="text-muted-foreground">*</span>
        </label>
        <LetterEditor
          content={content}
          onChange={setContent}
          placeholder="Tulis isi surat dari hatimu..."
          ariaLabel="Isi surat"
          describedBy="letter-content-error"
        />
        {contentEmpty && (
          <p id="letter-content-error" role="alert" className="text-xs text-destructive">
            Konten surat wajib diisi
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={isTimeCapsule}
            onChange={(e) => setIsTimeCapsule(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Lock className="h-3.5 w-3.5" />
              Time Capsule
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Surat akan terkunci dan baru bisa dibuka pada tanggal yang ditentukan
            </p>
          </div>
        </label>

        {isTimeCapsule ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="letter-unlock-date" className="text-xs font-medium text-muted-foreground">
                Tanggal
              </label>
              <input
                id="letter-unlock-date"
                type="date"
                value={unlockDate}
                onChange={(e) => {
                  setUnlockDate(e.target.value);
                  setUnlockError("");
                }}
                min={getJakartaToday()}
                className="flex h-9 w-full rounded-lg border border-input bg-card px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-invalid={!!unlockError}
                aria-describedby={unlockError ? "letter-unlock-error" : undefined}
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
                onChange={(e) => {
                  setUnlockTime(e.target.value);
                  setUnlockError("");
                }}
                className="flex h-9 w-full rounded-lg border border-input bg-card px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        ) : null}
        {isTimeCapsule && unlockError ? (
          <p id="letter-unlock-error" role="alert" className="mt-3 text-xs text-destructive">
            {unlockError}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (onClose) onClose();
            else router.push("/dashboard/letters");
          }}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          type="submit"
          className="flex-1 gap-2"
          disabled={loading || !formValid}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Kirim Surat
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
