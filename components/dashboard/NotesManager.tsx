"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useDailyNotes, useCreateNote, useDeleteNote } from "@/hooks/useNotes";
import { Button, Skeleton } from "@/components/ui";
import { Send, Heart, MessageCircle, Calendar, List, Loader2, Trash2 } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { getJakartaToday } from "@/lib/date";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";

export default function NotesManager() {
  const today = getJakartaToday();
  const { data: session } = useSession();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const [content, setContent] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<"all" | "date">("date");
  const { data: selectedNotes, isLoading, error } = useDailyNotes(
    viewMode === "all" ? undefined : selectedDate,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createNote.mutateAsync(content.trim());
      toast.success("Catatan terkirim! 💕");
      setContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim catatan");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await showDeleteConfirm({
      title: "Hapus Catatan",
      text: "Apakah Anda yakin ingin menghapus catatan ini?",
    });
    if (!confirmed) return;

    try {
      await deleteNote.mutateAsync(id);
      toast.success("Catatan berhasil dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus catatan");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 font-heading text-lg font-semibold">Tulis Catatan</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Apa yang kamu rasakan hari ini?"
              maxLength={280}
              rows={3}
              className="flex w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-16 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className={`absolute bottom-3 right-3 text-xs ${content.length >= 280 ? "text-destructive" : "text-muted-foreground"}`}>
              {content.length}/280
            </span>
          </div>
          <Button type="submit" disabled={!content.trim() || createNote.isPending} className="w-full gap-2">
            {createNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Kirim Catatan
          </Button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold">Riwayat Catatan</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-input">
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-3.5 w-3.5" />
                Semua
              </button>
              <button
                onClick={() => setViewMode("date")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  viewMode === "date"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Tanggal
              </button>
            </div>
            {viewMode === "date" && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                className="flex h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">Gagal memuat catatan</p>
          </div>
        ) : !selectedNotes || selectedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Belum ada catatan</p>
            <p className="text-sm text-muted-foreground">
              {viewMode === "all"
                ? "Tulis catatan pertama!"
                : selectedDate === today
                  ? "Tulis catatan pertama hari ini!"
                  : `Tidak ada catatan untuk ${formatDate(new Date(selectedDate))}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{viewMode === "all" ? "Semua catatan" : formatDate(new Date(selectedDate))}</span>
              <span>· {selectedNotes.length} catatan</span>
            </div>
            {selectedNotes.map((note, i) => {
              const isAuthor = session?.user?.id === note.authorId;

              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {note.author.name?.charAt(0) || "P"}
                      </div>
                      <span className="text-sm font-medium">
                        {note.author.name || "Pasangan"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(note.createdAt)}
                      </span>
                      {isAuthor && (
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Hapus catatan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {note.content}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Heart className="h-3 w-3" />
                    <span>Daily Note</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
