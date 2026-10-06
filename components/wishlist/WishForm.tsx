"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useCreateWish, useUpdateWish, useDeleteWish } from "@/hooks/useWishes";
import { Button } from "@/components/ui";
import GalleryPicker from "@/components/ui/GalleryPicker";
import { Plus, Loader2, X, Upload, ImagePlus, Trash2, Crop } from "lucide-react";
import { toast } from "sonner";
import { showDeleteConfirm } from "@/lib/swal";
import { uploadFileSimple } from "@/lib/chunked-upload";
import { resolveUploadMime } from "@/lib/upload-config";
import { parseCropRect, cropCoverStyle, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import PhotoCropper from "@/components/ui/PhotoCropper";
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

// 16:9 preview renders through the crop with the same math as the
// card — plain <img> so object URLs (fresh uploads) work too. Keep the frame at
// 16:9 everywhere (cropper, this preview, card) or cover-crop hides the match.
function WishPreview({ src, crop, onError }: { src: string; crop: CropRect | null; onError: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset measured dimensions when the image changes — render-time adjustment
  // (React-endorsed), not a post-paint effect, so no cascading render.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setNatural(null);
  }

  const style = crop && natural && frame
    ? cropCoverStyle(natural.w, natural.h, frame.w, frame.h, crop)
    : null;

  return (
    <div ref={ref} className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Preview gambar wish"
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }
        }}
        onError={onError}
        className="absolute max-w-none"
        style={style
          ? { width: style.width, height: style.height, left: style.left, top: style.top }
          : { width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

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
  const [imageCrop, setImageCrop] = useState<CropRect | null>(null);
  const [showCropper, setShowCropper] = useState(false);
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
      setImageCrop(parseCropRect((editingWish as { imageCrop?: unknown }).imageCrop));
      setOpen(true);
    }
  }, [editingWish]);

  function reset() {
    uploadRequestRef.current += 1;
    clearLocalPreview();
    setPreviewFailed(false);
    setImageUploading(false);
    setImageCrop(null);
    setShowCropper(false);
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

    // Extension fallback: browsers report "" for unrecognized formats (.heic).
    if (!resolveUploadMime(file.name, file.type).startsWith("image/")) {
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
      setImageCrop(null);
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
    // new image starts uncropped — crop is per-image, never inherited.
    setImageCrop(null);
    setShowGalleryPicker(false);
  }

  function confirmCrop(rect: CropRect) {
    const isFull = rect.x <= 0 && rect.y <= 0 && rect.w >= 1 && rect.h >= 1;
    setImageCrop(isFull ? null : rect);
    setShowCropper(false);
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
      imageCrop: imageUrl ? (imageCrop ?? null) : null,
    };

    try {
      if (isEditing) {
        await updateWish.mutateAsync({ id: editingWish.id, ...data });
        toast.success("Wish diperbarui!");
      } else {
        await createWish.mutateAsync({
          ...data,
          description: description.trim() || undefined,
          link: link.trim() || undefined,
          imageUrl: imageUrl || undefined,
          imageCrop: imageUrl ? (imageCrop ?? undefined) : undefined,
        });
        toast.success("Wish ditambahkan!");
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
                <label htmlFor="wish-title" className="text-sm font-medium">Judul *</label>
                <input
                  id="wish-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Apa yang kalian inginkan?"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="wish-description" className="text-sm font-medium">Deskripsi</label>
                <textarea
                  id="wish-description"
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
                      aria-pressed={category === cat.value}
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
                <label htmlFor="wish-link" className="text-sm font-medium">Link (opsional)</label>
                <input
                  id="wish-link"
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
                  <div className="relative w-full">
                    {previewFailed ? (
                      <div className="flex h-32 items-center justify-center rounded-xl bg-muted px-4 text-center text-sm text-muted-foreground">
                        Preview gambar tidak dapat dimuat. Silakan pilih foto lain.
                      </div>
                    ) : (
                      <WishPreview
                        src={localPreviewUrl || getOptimizedImageUrl(imageUrl, 1600)}
                        crop={imageCrop}
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
                        setImageCrop(null);
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
                  {(localPreviewUrl || imageUrl) && !previewFailed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowCropper(true)}
                      disabled={imageUploading}
                    >
                      <Crop className="h-4 w-4" />
                      {imageCrop ? "Ubah Crop" : "Atur Crop"}
                    </Button>
                  )}
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

            {showCropper && (localPreviewUrl || imageUrl) && (
              <PhotoCropper
                open
                src={localPreviewUrl || getOptimizedImageUrl(imageUrl, 2048)}
                aspect={16 / 9}
                initialRect={imageCrop}
                title="Crop Foto Wish"
                onCancel={() => setShowCropper(false)}
                onDone={confirmCrop}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
