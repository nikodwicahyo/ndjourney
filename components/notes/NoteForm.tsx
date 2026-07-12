"use client";

import { useState } from "react";
import { useCreateNote } from "@/hooks/useNotes";
import { Button } from "@/components/ui";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_LENGTH = 280;

export default function NoteForm({ onSuccess }: { onSuccess?: () => void }) {
  const createNote = useCreateNote();
  const [content, setContent] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createNote.mutateAsync(content.trim());
      toast.success("Catatan terkirim! 💕");
      setContent("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim catatan");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Apa yang kamu rasakan hari ini? (maks 280 karakter)"
          maxLength={MAX_LENGTH}
          rows={3}
          className="flex w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-16 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span
          className={`absolute bottom-3 right-3 text-xs ${
            content.length >= MAX_LENGTH
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {content.length}/{MAX_LENGTH}
        </span>
      </div>

      <Button
        type="submit"
        disabled={!content.trim() || createNote.isPending}
        className="w-full gap-2"
      >
        {createNote.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Kirim Catatan
          </>
        )}
      </Button>
    </form>
  );
}
