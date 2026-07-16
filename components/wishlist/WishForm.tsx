"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useCreateWish, useUpdateWish, useDeleteWish } from "@/hooks/useWishes";
import { Button } from "@/components/ui";
import GalleryPicker from "@/components/ui/GalleryPicker";
import { Plus, Loader2, X, Upload, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { showDeleteConfirm } from "@/lib/swal";
import { uploadFileSimple } from "@/lib/chunked-upload";
import type { WishItem } from "@/types";

const CATEGORIES = [
  { value: "DATE_IDEAS", label: "Date Ideas" },
  { value: "GIFTS", label: "Gifts" },
  { value: "TRAVEL", label: "Travel" },
  { value: "OTHER", label: "Lainnya" },
];

type WishFormProps = {
  editingWish?: WishItem | null;
  onClose?: () => void;
};

export default function WishForm({ editingWish, onClose }: WishFormProps) {
  const createWish = useCreateWish();
  const updateWish = useUpdateWish();
  const deleteWish = useDeleteWish();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [imageUrl, setImageUrl] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = useRef("");
  const uploadRequestRef = useRef(0);

  const isEditing = !!editingWish;

  function clearLocalPreview() {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = "";
    }
    setLocalPreviewUrl("");
  }

  function setLocalPreview(file: File) {
    clearLocalPreview();
    const nextPreviewUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = nextPreviewUrl;
    setLocalPreviewUrl(nextPreviewUrl);
  }

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editingWish) {
      clearLocalPreview();
      setPreviewFailed(false);
      setTitle(editingWish.title || "");
      setDescription(editingWish.description || "");
      setLink(editingWish.link || "");
      setCategory(editingWish.category || "OTHER");
      setImageUrl(editingWish.imageUrl || "");
      setOpen(true);
    }
  }, [editingWish]);

  function reset() {
    uploadRequestRef.current += 1;
    clearLocalPreview();
    setPreviewFailed(false);
    setImageUploading(false);
    setTitle("");
    setDescription("");
    setLink("");
    setCategory("OTHER");
    setImageUrl("");
    setOpen(false);
    onClose?.();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const resetFileInput = () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar yang valid");
      resetFileInput();
      return;
    }

    if (file.size === 0) {
      toast.error("File gambar kosong");
      resetFileInput();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maksimal 10MB");
      resetFileInput();
      return;
    }

    const requestId = ++uploadRequestRef.current;
    setLocalPreview(file);
    setPreviewFailed(false);
    setImageUploading(true);
    try {
      const result = await uploadFileSimple(file, () => {});
      if (requestId !== uploadRequestRef.current) return;
      setImageUrl(result.secureUrl || result.url);
      toast.success("Gambar berhasil diupload");
    } catch {
      if (requestId === uploadRequestRef.current) {
        clearLocalPreview();
        toast.error("Gagal upload gambar");
      }
    } finally {
      if (requestId === uploadRequestRef.current) setImageUploading(false);
      resetFileInput();
    }
  }

  async function openGalleryPicker() {
    setShowGalleryPicker(true);
  }

  function selectGalleryPhoto(photo: { id: string; url: string; thumbnailUrl: string | null }) {
    uploadRequestRef.current += 1;
    clearLocalPreview();
    setPreviewFailed(false);
    setImageUrl(photo.url);
    setShowGalleryPicker(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      category,
      imageUrl: imageUrl || null,
    };

    try {
      if (isEditing) {
        await updateWish.mutateAsync({ id: editingWish.id, ...data });
        toast.success("Wish diperbarui! 🎯");
      } else {
        await createWish.mutateAsync({
          ...data,
          description: description.trim() || undefined,
          link: link.trim() || undefined,
          imageUrl: imageUrl || undefined,
        });
        toast.success("Wish ditambahkan! 🎯");
      }
      reset();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan wish",
      );
    }
  }

  async function handleDelete() {
    if (!editingWish) return;

    const confirmed = await showDeleteConfirm({
      title: "Hapus Wish",
      text: `Apakah Anda yakin ingin menghapus "${editingWish.title}"?`,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteWish.mutateAsync(editingWish.id);
      toast.success("Wish dihapus");
      reset();
    } catch {
      toast.error("Gagal menghapus wish");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {!isEditing && (
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Wish
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">
                {isEditing ? "Edit Wish" : "Wish Baru"}
              </h2>
              <button
                onClick={reset}
                className="rounded-full p-1 transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Judul *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Apa yang kalian inginkan?"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Deskripsi</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan impian kalian..."
                  rows={2}
                  className="flex w-full resize-none rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        category === cat.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Link (opsional)</label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Foto (opsional)</label>
                {localPreviewUrl || imageUrl ? (
                  <div className="relative h-32 w-full overflow-hidden rounded-xl">
                    {previewFailed ? (
                      <div className="flex h-full items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
                        Preview gambar tidak dapat dimuat. Silakan pilih foto lain.
                      </div>
                    ) : (
                      <img
                        src={localPreviewUrl || imageUrl}
                        alt="Preview gambar wish"
                        className="h-full w-full object-cover"
                        onError={() => setPreviewFailed(true)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        uploadRequestRef.current += 1;
                        clearLocalPreview();
                        setPreviewFailed(false);
                        setImageUrl("");
                      }}
                      disabled={imageUploading}
                      aria-label="Hapus foto"
                      className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload Foto Baru
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={openGalleryPicker}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Pilih dari Galeri
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={reset}
                  disabled={createWish.isPending || updateWish.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    (createWish.isPending || updateWish.isPending) || !title.trim()
                  }
                >
                  {createWish.isPending || updateWish.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {isEditing ? "Simpan" : "Tambahkan"}
                    </>
                  )}
                </Button>
              </div>

              {isEditing && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deleting ? "Menghapus..." : "Hapus Wish"}
                  </button>
                </div>
              )}
            </form>

            {showGalleryPicker && (
              <GalleryPicker
                open={showGalleryPicker}
                onClose={() => setShowGalleryPicker(false)}
                onSelect={(photo) =>
                  selectGalleryPhoto({
                    id: photo.id,
                    url: photo.url,
                    thumbnailUrl: photo.thumbnailUrl,
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
