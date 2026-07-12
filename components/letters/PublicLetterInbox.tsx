"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLetters } from "@/hooks/useLetters";
import LetterCard from "./LetterCard";
import { Skeleton, Button } from "@/components/ui";
import { Inbox, Send, MailQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const TABS: { key: "inbox" | "sent"; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Pesan Masuk", icon: Inbox },
  { key: "sent", label: "Terkirim", icon: Send },
];

export default function PublicLetterInbox() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const { data: letters, isLoading, error } = useLetters(tab);

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <MailQuestion className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Login untuk melihat surat</p>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Login
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Gagal memuat surat</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  const hasUnread =
    tab === "inbox" && letters
      ? letters.filter((l) => !l.isOpened).length
      : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "inbox" && hasUnread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {hasUnread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {letters && letters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <MailQuestion className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {tab === "inbox" ? "Belum ada surat" : "Belum mengirim surat"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "inbox"
                ? "Tunggu pasanganmu menulis surat untukmu"
                : "Kirim surat dari halaman dashboard"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {letters?.map((letter, i) => (
            <LetterCard key={letter.id} letter={letter} type={tab} index={i} baseHref="/letters" />
          ))}
        </div>
      )}
    </div>
  );
}
