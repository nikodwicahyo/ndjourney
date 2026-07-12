"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLetter, useOpenLetter } from "@/hooks/useLetters";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

import { LETTER_MOOD_CONFIG } from "@/types";
import { Skeleton, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { Heart, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import EnvelopeAnimation from "./EnvelopeAnimation";
import TimeCapsuleLock from "./TimeCapsuleLock";

type LetterViewerProps = {
  id: string;
  isRecipient: boolean;
  backHref?: string;
};

export default function LetterViewer({ id, isRecipient, backHref = "/dashboard/letters" }: LetterViewerProps) {
  const { data: letter, isLoading, error } = useLetter(id);
  const openLetter = useOpenLetter();
  const [isOpening, setIsOpening] = useState(false);
  const [opened, setOpened] = useState(false);

  const [sanitizedContent, setSanitizedContent] = useState("");

  useEffect(() => {
    if (!letter?.content) {
      setSanitizedContent("");
      return;
    }
    import("dompurify").then((DOMPurify) => {
      setSanitizedContent(
        DOMPurify.default.sanitize(letter.content, {
          ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "pre", "code", "span", "div", "hr", "a"],
          ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
          ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
        }),
      );
    });
  }, [letter?.content]);

  const isLocked =
    letter?.isTimeCapsule &&
    letter?.unlockAt &&
    new Date(letter.unlockAt) > new Date() &&
    !letter?.isOpened;

  async function handleOpen() {
    setIsOpening(true);
    try {
      await openLetter.mutateAsync(id);
      setOpened(true);
      toast.success("Surat dibuka! 💕");
    } catch {
      toast.error("Gagal membuka surat");
    } finally {
      setIsOpening(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !letter) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive">Surat tidak ditemukan</p>
        <Link
          href={backHref}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Kembali
        </Link>
      </div>
    );
  }

  const mood = letter.mood
    ? LETTER_MOOD_CONFIG[letter.mood as keyof typeof LETTER_MOOD_CONFIG]
    : null;

  if ("isTimeCapsule" in letter && isLocked) {
    return (
      <TimeCapsuleLock
        unlockAt={letter.unlockAt ? new Date(letter.unlockAt).toISOString() : new Date().toISOString()}
        title={letter.title}
        senderName={letter.author?.name || "Pasangan"}
        senderImage={letter.author?.image ?? null}
        backHref={backHref}
      />
    );
  }

  const showUnlockAnimation = isRecipient && !letter.isOpened && !opened;

  return (
    <div className="mx-auto max-w-2xl">
      <AnimatePresence mode="wait">
        {showUnlockAnimation ? (
          <EnvelopeAnimation
            key="envelope"
            senderName={letter.author?.name || "Pasangan"}
            letterTitle={letter.title}
            isOpening={isOpening}
            onOpen={handleOpen}
          />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              {mood && (
                <div
                  className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: mood.color + "20", color: mood.color }}
                >
                  {mood.emoji} {mood.label}
                </div>
              )}

              <h1 className="font-heading text-2xl font-semibold">
                {letter.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={letter.author?.image ?? undefined} alt={letter.author?.name ?? "Author"} />
                    <AvatarFallback>{letter.author?.name?.charAt(0) || "P"}</AvatarFallback>
                  </Avatar>
                  <Heart className="h-3.5 w-3.5" />
                  {letter.author?.name || "Pasangan"}
                </span>
                <span>·</span>
                <span>{formatDateTime(letter.createdAt)}</span>
                {letter.isTimeCapsule && letter.openedAt && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Dibuka {formatRelativeTime(letter.openedAt)}
                    </span>
                  </>
                )}
              </div>

              <div
                className="tiptap-content mt-6 text-base leading-relaxed text-foreground/90"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
