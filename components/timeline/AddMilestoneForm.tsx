"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useCreateMilestone, useUpdateMilestone } from "@/hooks/useMilestones";
import { Button } from "@/components/ui";
import GalleryPicker from "@/components/ui/GalleryPicker";
import { X, Loader2, Upload, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";
import { uploadFileSimple } from "@/lib/chunked-upload";
import { getJakartaDateOnly, getJakartaToday } from "@/lib/date";

const EMOJIS = [
  "💕", "❤️", "🥰", "😊", "🎉", "🎂", "✈️", "🏖️", "⛰️", "🌅",
  "🌸", "🍀", "🎁", "💍", "🏠", "🍝", "🎬", "📸", "🎵", "💌",
];

const COLORS = [
  "#F43F5E", "#EC4899", "#F97316", "#EAB308", "#22C55E",
  "#14B8A6", "#6366F1", "#8B5CF6", "#A855F7", "#06B6D4",
];

type AddMilestoneFormProps = {
  milestone?: MilestoneWithRelations | null;
  onClose: () => void;
};

export default function AddMilestoneForm({
  milestone,
  onClose,
}: AddMilestoneFormProps) {
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const isEditing = !!milestone;

  const [title, setTitle] = useState(milestone?.title || "");
  const [description, setDescription] = useState(
    milestone?.description || "",
  );
  const [date, setDate] = useState(
    milestone
      ? getJakartaDateOnly(milestone.date)
      : getJakartaToday(),
  );
  const [icon, setIcon] = useState(milestone?.icon || "💕");
  const [color, setColor] = useState(milestone?.color || COLORS[0]);
  const [location, setLocation] = useState(milestone?.location || "");
  const [loading, setLoading] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState<
    Array<{ id?: string; url: string; thumbnailUrl: string | null; publicId?: string }>
  >(milestone?.photos?.map((p) => ({ ...p.photo, publicId: undefined })) || []);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadFileSimple(file, () => {});
        setSelectedPhotos((prev) => [
          ...prev,
          { url: result.url, thumbnailUrl: result.thumbnailUrl ?? null, publicId: result.publicId },
        ]);
      } catch {
        toast.error(`Gagal upload ${file.name}`);
      }
    }
    setUploadingPhotos(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(key: string) {
    setSelectedPhotos((prev) => prev.filter((p) => (p.id || p.publicId) !== key));
  }

  function isPhotoSelected(photoId: string) {
    return selectedPhotos.some((p) => p.id === photoId);
  }

  async function openGalleryPicker() {
    setShowGalleryPicker(true);
  }

  function toggleGalleryPhoto(photo: { id: string; url: string; thumbnailUrl: string | null }) {
    setSelectedPhotos((prev) => {
      const exists = prev.find((p) => p.id === photo.id);
      if (exists) return prev.filter((p) => p.id !== photo.id);
      return [...prev, { id: photo.id, url: photo.url, thumbnailUrl: photo.thumbnailUrl }];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul milestone wajib diisi");
      return;
    }

    setLoading(true);

    const photoIds: string[] = [];
    const photoUploads: { url: string; publicId: string; thumbnailUrl?: string }[] = [];
    for (const p of selectedPhotos) {
      if (p.id) {
        photoIds.push(p.id);
      } else if (p.publicId) {
        photoUploads.push({ url: p.url, publicId: p.publicId, thumbnailUrl: p.thumbnailUrl ?? undefined });
      }
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      icon,
      color,
      location: location.trim() || undefined,
      photoIds,
      photoUploads: photoUploads.length > 0 ? photoUploads : undefined,
    };

    try {
      if (isEditing) {
        await updateMilestone.mutateAsync({ id: milestone.id, ...data });
        toast.success("Milestone diperbarui! 💕");
      } else {
        await createMilestone.mutateAsync(data);
        toast.success("Milestone baru ditambahkan! 🎉");
      }
      onClose();
    } catch {
      toast.error("Gagal menyimpan milestone");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            {isEditing ? "Edit Milestone" : "Tambah Milestone"}
          </h2>
          <button
            onClick={onClose}
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
              placeholder="Contoh: First Date"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tanggal *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan momen ini..."
              rows={3}
              className="flex w-full resize-none rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Icon / Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors ${
                    icon === e
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Warna</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-ring ring-offset-2 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Lokasi</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contok: Café Senja, Bandung"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Foto</label>
            {selectedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPhotos.map((photo) => (
                  <div key={photo.id || photo.publicId} className="group relative h-16 w-16 overflow-hidden rounded-lg md:h-20 md:w-20">
                    <Image
                      src={photo.thumbnailUrl || photo.url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id || photo.publicId || photo.url)}
                      aria-label="Hapus foto"
                      className="absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhotos}
              >
                {uploadingPhotos ? (
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
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : isEditing ? (
                "Simpan"
              ) : (
                "Tambah 💕"
              )}
            </Button>
          </div>
        </form>

        {showGalleryPicker && (
          <GalleryPicker
            open={showGalleryPicker}
            multi
            selectedIds={selectedPhotos.map((p) => p.id).filter(Boolean) as string[]}
            onClose={() => setShowGalleryPicker(false)}
            onSelect={(photo) =>
              toggleGalleryPhoto({
                id: photo.id,
                url: photo.url,
                thumbnailUrl: photo.thumbnailUrl,
              })
            }
          />
        )}
      </div>
    </div>
  );
}
