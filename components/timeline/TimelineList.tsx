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
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { showDeleteConfirm } from "@/lib/swal";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";

export default function TimelineList() {
  const { data: session } = useSession();
  const { data: milestones, isLoading, error, refetch } = useMilestones();
  const deleteMilestone = useDeleteMilestone();
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<MilestoneWithRelations | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const openEdit = useCallback((m: MilestoneWithRelations) => {
    setEditingMilestone(m);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await showDeleteConfirm({
        title: "Hapus Milestone",
        text: "Apakah Anda yakin ingin menghapus milestone ini?",
      });
      if (!confirmed) return;
      deleteMilestone.mutate(id, {
        onSuccess: () => toast.success("Milestone dihapus"),
        onError: () => toast.error("Gagal menghapus milestone"),
      });
    },
    [deleteMilestone],
  );

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
        <div>
          <p className="text-sm text-muted-foreground">
            {milestones.length} kenangan
          </p>
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
          {milestones.map((milestone, index) => (
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
