"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMilestones, useDeleteMilestone } from "@/hooks/useMilestones";
import MilestoneDetailDialog from "@/components/timeline/MilestoneDetailDialog";
import MilestoneCard from "@/components/timeline/MilestoneCard";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Heart } from "lucide-react";
import { startMutationToast, settleMutationToast } from "@/lib/mutation-feedback";

const AddMilestoneForm = dynamic(() => import("@/components/timeline/AddMilestoneForm"), {
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted" />,
});

export default function TimelineManager() {
  const { data: milestones, isLoading, error, refetch } = useMilestones();
  const deleteMilestone = useDeleteMilestone();
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<import("@/hooks/useMilestones").MilestoneWithRelations | null>(null);
  const searchParams = useSearchParams();
  const milestoneParam = searchParams.get("milestone");

  // Deep link from push/notification or recent activity ("?milestone=<id>") →
  // open that exact milestone in the detail modal. Derived live from the
  // query param + list, so it opens as soon as the data is hydrated/loaded
  // and nothing stale reopens after dismissal.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const deepLinkedId =
    milestoneParam && milestoneParam !== dismissedFor ? milestoneParam : null;
  const deepLinkedMilestone = deepLinkedId
    ? (milestones ?? []).find((m) => m.id === deepLinkedId) ?? null
    : null;

  const openEdit = useCallback((m: import("@/hooks/useMilestones").MilestoneWithRelations) => {
    setEditingMilestone(m);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      // Single confirmation lives in MilestoneCard (with the milestone title)
      // — confirming here too showed two dialogs in a row.
      if (deleteMilestone.isPending) return;
      const toastId = startMutationToast("Menghapus milestone...");
      try {
        await deleteMilestone.mutateAsync(id);
        settleMutationToast(toastId, "success", "Milestone dihapus");
      } catch {
        settleMutationToast(toastId, "error", "Gagal menghapus milestone");
      }
    },
    [deleteMilestone],
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="hidden h-10 w-10 rounded-full md:block" />
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
      <div className="flex flex-col items-center gap-4 py-20">
        <p role="alert" className="text-destructive">Gagal memuat timeline</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">
          Timeline ({milestones?.length ?? 0})
        </h2>
        <Button
          onClick={() => {
            setEditingMilestone(null);
            setShowForm(true);
          }}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Milestone
        </Button>
      </div>

      {!milestones || milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Heart className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Belum ada milestone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambah kenangan pertama kalian!
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah Milestone
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 hidden w-0.5 bg-border md:block" />
          <div className="space-y-10 md:space-y-12">
            {milestones.map((milestone, index) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                index={index}
                isAuthenticated
                onEdit={openEdit}
                onDelete={handleDelete}
                isDeleting={deleteMilestone.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <AddMilestoneForm
          milestone={editingMilestone}
          onClose={() => {
            setShowForm(false);
            setEditingMilestone(null);
          }}
        />
      )}

      {deepLinkedMilestone && (
        <MilestoneDetailDialog
          milestone={deepLinkedMilestone}
          open
          onOpenChange={(next) => {
            if (!next) setDismissedFor(milestoneParam);
          }}
          isAuthenticated
          onEdit={(m) => {
            setDismissedFor(milestoneParam);
            openEdit(m);
          }}
          onDelete={handleDelete}
          isDeleting={deleteMilestone.isPending}
        />
      )}
    </div>
  );
}
