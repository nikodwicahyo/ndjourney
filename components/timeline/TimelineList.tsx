"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  useMilestones,
  useDeleteMilestone,
} from "@/hooks/useMilestones";
import MilestoneCard from "./MilestoneCard";

const AddMilestoneForm = dynamic(() => import("./AddMilestoneForm"), {
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted" />,
});
import { Button, Skeleton } from "@/components/ui";
import { Heart, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";

export default function TimelineList() {
  const { data: session } = useSession();
  const { data: milestones, isLoading, error, refetch } = useMilestones();
  const deleteMilestone = useDeleteMilestone();
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<MilestoneWithRelations | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const openEdit = useCallback((m: MilestoneWithRelations) => {
    setEditingMilestone(m);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMilestone.mutate(id, {
        onSuccess: () => toast.success("Milestone dihapus"),
        onError: () => toast.error("Gagal menghapus milestone"),
      });
    },
    [deleteMilestone],
  );

  const filtered = milestones
    ? photosOnly
      ? milestones.filter((m) => m.photos.length > 0)
      : milestones
    : [];

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

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">Belum ada milestone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambah kenangan pertama kalian!
          </p>
        </div>
        {session?.user && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah Milestone
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} kenangan
          </p>
          <button
            onClick={() => setPhotosOnly(!photosOnly)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              photosOnly
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <Filter className="h-3 w-3" />
            Hanya foto
          </button>
        </div>

        {session?.user && (
          <Button
            onClick={() => {
              setEditingMilestone(null);
              setShowForm(true);
            }}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 hidden w-0.5 bg-border md:block" />

        <div className="space-y-10 md:space-y-12">
          {filtered.map((milestone, index) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              index={index}
              isAuthenticated={!!session?.user}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {showForm && (
        <AddMilestoneForm
          milestone={editingMilestone}
          onClose={() => {
            setShowForm(false);
            setEditingMilestone(null);
          }}
        />
      )}
    </div>
  );
}
