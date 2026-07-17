"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coffee, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";

type Wish = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
};

async function fetchWishes(): Promise<Wish[]> {
  const res = await fetch("/api/wishes?limit=100", { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat ide");
  const json = await res.json();
  return (json.data ?? []) as Wish[];
}

export default function NearbySuggestion() {
  const { data, isLoading } = useQuery({
    queryKey: ["wishes", "location-suggest"],
    queryFn: fetchWishes,
    staleTime: 60_000,
  });

  const [seed, setSeed] = useState(0);

  if (isLoading || !data || data.length === 0) return null;

  const pending = data.filter((w) => !w.title.toLowerCase().includes("done"));
  const pool = pending.length > 0 ? pending : data;
  const idea = pool[Math.floor((Math.random() * pool.length + seed) % pool.length)];

  return (
    <motion.div
      key={seed}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Coffee className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Ide ngedate bareng
        </div>
        <p className="mt-0.5 truncate font-medium text-foreground">{idea.title}</p>
        {idea.description && (
          <p className="truncate text-xs text-muted-foreground">
            {idea.description}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => setSeed((s) => s + 1)}
      >
        <RefreshCw className="mr-1 h-3 w-3" />
        Lainnya
      </Button>
    </motion.div>
  );
}
