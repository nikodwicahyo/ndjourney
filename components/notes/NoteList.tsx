"use client";

import { useDailyNotes } from "@/hooks/useNotes";
import { Skeleton, Button, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Calendar } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { getJakartaToday } from "@/lib/date";

export default function NoteList() {
  const today = getJakartaToday();
  const { data: notes, isLoading, error } = useDailyNotes(today);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-destructive">Gagal memuat catatan</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Belum ada catatan hari ini</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Jadilah yang pertama untuk menulis!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDate(new Date())}</span>
      </div>

      {notes.map((note, i) => (
        <motion.div
          key={note.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={note.author.image ?? undefined} alt={note.author.name ?? "Author"} />
                <AvatarFallback>{note.author.name?.charAt(0) || "P"}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {note.author.name || "Pasangan"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(note.createdAt)}
            </span>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {note.content}
          </p>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" />
            <span>Daily Note</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
