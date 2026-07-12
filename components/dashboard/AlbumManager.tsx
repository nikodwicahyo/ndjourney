"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Loader2, X, Trash2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import type { AlbumWithCount } from "@/types";

export default function AlbumManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
    mutationFn: async (data: { name: string; description?: string }) => {
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
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal"),
  });

  const updateAlbum = useMutation({
    mutationFn: async ({
      id,
      name,
    }: {
      id: string;
      name: string;
    }) => {
      const res = await fetch(`/api/albums/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengupdate album");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Nama album diubah");
      setEditingId(null);
      setEditName("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal"),
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
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updateAlbum.mutate({ id: editingId, name: editName.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Album</h3>
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
            <Button
              onClick={() => createAlbum.mutate({ name: name.trim(), description: description.trim() || undefined })}
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !albums || albums.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Belum ada album
        </p>
      ) : (
        <div className="space-y-2">
          {albums.map((album) => (
            <div
              key={album.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              {editingId === album.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    placeholder="Nama album"
                    autoFocus
                    className="h-8 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
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
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{album.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {"_count" in album && album._count
                        ? `${album._count.photos} foto`
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditing(album)}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus album "${album.name}"?`)) {
                          deleteAlbum.mutate(album.id);
                        }
                      }}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
