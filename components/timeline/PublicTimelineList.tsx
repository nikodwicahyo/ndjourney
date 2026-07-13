"use client";

import { useRef } from "react";
import { useMilestones } from "@/hooks/useMilestones";
import MilestoneCard from "./MilestoneCard";
import { Button, Skeleton } from "@/components/ui";
import { Heart } from "lucide-react";

export default function PublicTimelineList() {
  const { data: milestones, isLoading, error, refetch } = useMilestones();
  const containerRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="hidden md:block">
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Gagal memuat timeline</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (!milestones || milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">Belum ada milestone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Belum ada kenangan yang ditambahkan
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {milestones.length} kenangan
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 hidden w-0.5 bg-border md:block" />

        <div className="space-y-10 md:space-y-12">
          {milestones.map((milestone, index) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              index={index}
              isAuthenticated={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
