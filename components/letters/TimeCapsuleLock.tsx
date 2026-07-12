"use client";

import { motion } from "framer-motion";
import { Lock, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatInJakarta } from "@/lib/date";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui";

type TimeCapsuleLockProps = {
  unlockAt: string | Date;
  title?: string;
  senderName?: string;
  senderImage?: string | null;
  backHref?: string;
};

export default function TimeCapsuleLock({
  unlockAt,
  title,
  senderName,
  senderImage,
  backHref = "/dashboard/letters",
}: TimeCapsuleLockProps) {
  const unlockDate = new Date(unlockAt);
  const now = new Date();
  const diffMs = unlockDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(249,115,22,0.4)",
              "0 0 0 20px rgba(249,115,22,0)",
            ],
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-lg">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </motion.div>

        <h1 className="font-heading text-2xl font-semibold">
          Time Capsule 🔒
        </h1>

        {title && (
          <p className="mt-2 text-sm text-muted-foreground">
            &ldquo;{title}&rdquo;
          </p>
        )}

        {senderName && (
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={senderImage ?? undefined} alt={senderName ?? "Sender"} />
              <AvatarFallback>{senderName?.charAt(0) || "P"}</AvatarFallback>
            </Avatar>
            <span>Dari {senderName}</span>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Surat ini akan terbuka pada
          </p>
          <p className="font-medium text-primary">
            {formatInJakarta(unlockAt, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatInJakarta(unlockAt, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {diffDays > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm text-orange-600 dark:text-orange-400"
          >
            <Clock className="h-4 w-4" />
            <span>
              {diffDays} hari lagi
            </span>
          </motion.div>
        )}

        {diffDays <= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-sm text-green-600 dark:text-green-400"
          >
            <Clock className="h-4 w-4" />
            <span>Siap dibuka!</span>
          </motion.div>
        )}

        <Link
          href={backHref}
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </motion.div>
    </div>
  );
}
