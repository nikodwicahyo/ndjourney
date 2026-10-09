"use client";

import Link from "next/link";
import React from "react";
import { Lock, Clock, ChevronRight, Trash2 } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { formatInJakarta } from "@/lib/date";
import { LETTER_MOOD_CONFIG } from "@/types";
import type { LetterListItem } from "@/hooks/useLetters";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui";

type LetterCardProps = {
  letter: LetterListItem;
  type: "inbox" | "sent";
  index?: number;
  baseHref?: string;
  onDelete?: () => void;
};

function LetterCard({ letter, type, index = 0, baseHref = "/dashboard/letters", onDelete }: LetterCardProps) {
  const mood = LETTER_MOOD_CONFIG[letter.mood as keyof typeof LETTER_MOOD_CONFIG];
  const isLocked =
    letter.isTimeCapsule &&
    letter.unlockAt &&
    new Date(letter.unlockAt) > new Date() &&
    !letter.isOpened;
  // Both tabs anchor on the author: inbox reads who it's from,
  // sent reads who it's for — avatar is always the sender (you).
  const shown = letter.author;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
        isLocked && "opacity-70",
        !letter.isOpened && type === "inbox" && "border-primary/30 bg-primary/[0.02]",
      )}
    >
      <Link
        href={`${baseHref}/${letter.id}`}
        className={cn("flex w-full items-start gap-4", onDelete && "pr-12")}
      >
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={shown.image ?? undefined} alt={shown.name ?? "Pasangan"} />
          <AvatarFallback>{shown.name?.charAt(0) || "P"}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "truncate font-medium",
                !letter.isOpened && type === "inbox" && "font-semibold",
              )}
            >
              {letter.title}
            </h3>
            {!letter.isOpened && type === "inbox" && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span>
              {type === "inbox"
                ? `From: ${letter.author.name || "Pasangan"}`
                : `To: ${letter.recipient.name || "Pasangan"}`}
            </span>
            <span>·</span>
            <span>{formatDateTime(letter.createdAt)}</span>
            {isLocked && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {letter.unlockAt
                    ? formatInJakarta(letter.unlockAt, { dateStyle: "long" })
                    : ""}
                </span>
              </>
            )}
          </div>

          {isLocked && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Time capsule — belum bisa dibuka
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 right-2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Hapus surat"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default React.memo(LetterCard);
