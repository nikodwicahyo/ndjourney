"use client";

import { useState } from "react";
import { useWishes } from "@/hooks/useWishes";
import WishCard from "@/components/wishlist/WishCard";
import WishForm from "@/components/wishlist/WishForm";
import { Button, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import { Gift, Filter, Heart, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WishItem } from "@/types";

const CATEGORIES = [
  { value: "", label: "Semua", icon: Gift },
  { value: "DATE_IDEAS", label: "Date Ideas", icon: Heart },
  { value: "GIFTS", label: "Gifts", icon: Gift },
  { value: "TRAVEL", label: "Travel", icon: PartyPopper },
  { value: "OTHER", label: "Lainnya", icon: Gift },
];

export default function WishlistManager() {
  const { data: wishes, isLoading, error } = useWishes();
  const [filter, setFilter] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [editingWish, setEditingWish] = useState<WishItem | null>(null);

  const filtered = (wishes || [])
    .filter((w) => !filter || w.category === filter)
    .filter((w) => showDone || !w.isDone);

  const totalCount = (wishes || []).length;
  const doneCount = (wishes || []).filter((w) => w.isDone).length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">Gagal memuat wish list</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {totalCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">
                <span className="font-heading text-lg font-semibold text-primary">{doneCount}</span>
                {" "}dari{" "}
                <span className="font-heading text-lg font-semibold">{totalCount}</span>
                {" "}wish tercapai! ❤️
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                filter === cat.value
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
              )}
            >
              <cat.icon className="h-3 w-3" />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDone(!showDone)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              showDone
                ? "border-border text-muted-foreground"
                : "border-primary bg-primary/10 text-primary",
            )}
          >
            <Filter className="h-3 w-3" />
            {showDone ? "Semua" : "Belum"}
          </button>

          <WishForm
            editingWish={editingWish}
            onClose={() => setEditingWish(null)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{filtered.length} wish</span>
        {!showDone && <span>(sembunyikan yang tercapai)</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Gift className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Belum ada wish</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter ? "Tidak ada wish di kategori ini" : "Tambahkan wish pertama kalian!"}
            </p>
          </div>
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((wish) => (
            <WishCard key={wish.id} wish={wish} onEdit={setEditingWish} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
