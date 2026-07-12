"use client";

import { useState, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateLetter, usePartner } from "@/hooks/useLetters";
import { Button, Skeleton } from "@/components/ui";
import { LETTER_MOOD_CONFIG } from "@/types";
import { X, Loader2, Clock, Lock, Sparkles } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

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
      toast.error("Pilih tanggal pembukaan time capsule");
      return;
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
      toast.success("Surat terkirim! 💌");
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
            className="rounded-full p-1 transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Untuk</label>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm">
          <span className="text-lg">{partner.image ? <Image src={partner.image} alt="" className="h-5 w-5 rounded-full" width={20} height={20} /> : "💕"}</span>
          <span className="font-medium">{partner.name || "Pasangan"}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Judul *</label>
          <span className="text-xs text-muted-foreground">{title.length}/200</span>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul surat..."
          maxLength={200}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mood</label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMood(key)}
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
        />
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

        {isTimeCapsule && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tanggal
              </label>
              <input
                type="date"
                value={unlockDate}
                onChange={(e) => setUnlockDate(e.target.value)}
                min={getJakartaToday()}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Jam
              </label>
              <input
                type="time"
                value={unlockTime}
                onChange={(e) => setUnlockTime(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 gap-2"
          disabled={loading || !partner}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Kirim Surat 💌
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
