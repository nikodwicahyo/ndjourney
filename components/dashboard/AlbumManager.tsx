"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Loader2, X, Trash2, Pencil, Check, Globe, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { showDeleteConfirm } from "@/lib/swal";
import { cn } from "@/lib/utils";
import type { AlbumWithCount } from "@/types";

export default function AlbumManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

  const { data: albums, isLoading } = useQuery({
    queryKey: ["albums", "all"],
    queryFn: async () => {
      const res = await fetch("/api/albums");
      const json = await res.json();
      return json.data as AlbumWithCount[];
    },
    staleTime: 60_000,
  });

  const createAlbum = useMutation({
    mutationFn: async (data: { name: string; description?: string; isPublic: boolean }) => {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat album");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album dibuat! 📁");
      setShowForm(false);
      setName("");
      setDescription("");
      setIsPublic(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat album"),
  });

  const updateAlbum = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      isPublic,
    }: {
      id: string;
      name: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      const res = await fetch(`/api/albums/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined, isPublic }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengupdate album");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album diubah");
      setEditingId(null);
      setEditName("");
      setEditDescription("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengupdate album"),
  });

  const deleteAlbum = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus album");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Album dihapus");
    },
    onError: () => toast.error("Gagal menghapus album"),
  });

  function startEditing(album: AlbumWithCount) {
    setEditingId(album.id);
    setEditName(album.name);
    setEditDescription(album.description ?? "");
    setEditIsPublic(album.isPublic);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditIsPublic(true);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updateAlbum.mutate({
      id: editingId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      isPublic: editIsPublic,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-lg">Album</h2>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Batal" : "Tambah"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Buat Album Baru</p>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-full p-1 transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama album"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 py-2.5 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">Visibilitas</span>
                <span className="text-xs text-muted-foreground">
                  Tampil di gallery publik/privat
                </span>
              </span>
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    isPublic
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Publik
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    !isPublic
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Privat
                </button>
              </div>
            </div>
            <Button
              onClick={() => createAlbum.mutate({ name: name.trim(), description: description.trim() || undefined, isPublic })}
              disabled={!name.trim() || createAlbum.isPending}
              className="w-full gap-2"
            >
              {createAlbum.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Buat Album
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : !albums || albums.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Belum ada album
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group relative rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              {editingId === album.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) saveEdit();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    placeholder="Nama album"
                    autoFocus
                    className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Deskripsi (opsional)"
                    className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-1.5 text-sm">
                    <span className="font-medium">Visibilitas</span>
                    <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setEditIsPublic(true)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                          editIsPublic
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Globe className="h-3 w-3" />
                        Publik
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditIsPublic(false)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                          !editIsPublic
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <EyeOff className="h-3 w-3" />
                        Privat
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim() || updateAlbum.isPending}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                    >
                      {updateAlbum.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={updateAlbum.isPending}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium">
                        {album.name}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({album._count ? album._count.photos : "—"} file)
                        </span>
                      </h3>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          album.isPublic
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {album.isPublic ? "Publik" : "Privat"}
                      </span>
                      {album.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/70 leading-relaxed">
                          {album.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEditing(album)}
                        className="rounded-full p-1.5 text-muted-foreground transition-all hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await showDeleteConfirm({
                            title: "Hapus Album",
                            text: `Apakah Anda yakin ingin menghapus album "${album.name}"?`,
                          });
                          if (confirmed) {
                            deleteAlbum.mutate(album.id);
                          }
                        }}
                        className="rounded-full p-1.5 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
