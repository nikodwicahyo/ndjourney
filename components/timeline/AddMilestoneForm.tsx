"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useCreateMilestone, useUpdateMilestone } from "@/hooks/useMilestones";
import { Button } from "@/components/ui";
import GalleryPicker from "@/components/ui/GalleryPicker";
import PhotoCropper from "@/components/ui/PhotoCropper";
import { X, Loader2, Upload, ImagePlus, Crop } from "lucide-react";
import { toast } from "sonner";
import type { MilestoneWithRelations } from "@/hooks/useMilestones";
import { uploadFileSimple } from "@/lib/chunked-upload";
import { getJakartaDateOnly, getJakartaToday } from "@/lib/date";
import { cn } from "@/lib/utils";
import { parseCropRect, cropCoverStyle, cropDisplaySrc, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

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

// square thumb renders through the crop with the same math as the
// card — the form shows exactly what the timeline will show. src = ORIGINAL
// url (rects are original-space), thumb = square fill for the no-crop case.
function FormThumb({ src, thumb, crop }: { src: string; thumb?: string | null; crop: CropRect | null }) {
  // Cloudinary variant of the picked URL (aspect-preserving, so crop
  // fractions stay exact) — raw originals are multi-MB/HEIC and blow up
  // /_next/image's 7s fetch timeout (500) or never decode in the browser.
  const url = getOptimizedImageUrl(cropDisplaySrc(src, thumb, crop), 640);
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
  const [prevUrl, setPrevUrl] = useState(url);
  if (prevUrl !== url) {
    setPrevUrl(url);
    setNatural(null);
  }

  const style = crop && natural && frame
    ? cropCoverStyle(natural.w, natural.h, frame.w, frame.h, crop)
    : null;

  return (
    <div ref={ref} className="absolute inset-0">
      {style ? (
        <Image
          src={url}
          alt=""
          width={Math.round(style.width)}
          height={Math.round(style.height)}
          loading="eager"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
          className="absolute max-w-none"
          style={{ left: style.left, top: style.top }}
          sizes="80px"
        />
      ) : (
        <Image
          src={url}
          alt=""
          fill
          loading="eager"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
          sizes="80px"
          className="object-cover"
        />
      )}
    </div>
  );
}

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
    Array<{ id?: string; url: string; thumbnailUrl: string | null; publicId?: string; crop?: CropRect | null }>
  >(milestone?.photos?.map((p) => ({ ...p.photo, publicId: undefined, crop: parseCropRect(p.crop) })) || []);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  // crop rides the photo item — removing the photo drops its crop, no orphans.
  const [cropTarget, setCropTarget] = useState<{ key: string; src: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // hard cap 2 (server 400s beyond) — trim extras instead of failing the batch.
    const slots = Math.max(0, 2 - selectedPhotos.length);
    if (slots === 0) {
      toast.error("Maksimal 2 foto per milestone");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const picked = Array.from(files).slice(0, slots);
    if (picked.length < files.length) toast.error(`Maksimal 2 foto — ${files.length - picked.length} file dilewati`);

    setUploadingPhotos(true);
    for (const file of picked) {
      try {
        const result = await uploadFileSimple(file, () => {});
        setSelectedPhotos((prev) =>
          prev.length >= 2
            ? prev
            : [...prev, { url: result.url, thumbnailUrl: result.thumbnailUrl ?? null, publicId: result.publicId }],
        );
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
    const exists = selectedPhotos.some((p) => p.id === photo.id);
    if (!exists && selectedPhotos.length >= 2) {
      toast.error("Maksimal 2 foto per milestone");
      return;
    }
    setSelectedPhotos((prev) => {
      if (prev.some((p) => p.id === photo.id)) return prev.filter((p) => p.id !== photo.id);
      return [...prev, { id: photo.id, url: photo.url, thumbnailUrl: photo.thumbnailUrl, crop: null }];
    });
  }

  function confirmCrop(rect: CropRect) {
    const target = cropTarget;
    if (!target) return;
    const isFull = rect.x <= 0 && rect.y <= 0 && rect.w >= 1 && rect.h >= 1;
    setSelectedPhotos((prev) =>
      prev.map((p) => ((p.id || p.publicId) === target.key ? { ...p, crop: isFull ? null : rect } : p)),
    );
    setCropTarget(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul milestone wajib diisi");
      return;
    }

    setLoading(true);

    const photoIds: string[] = [];
    const photoUploads: { url: string; publicId: string; thumbnailUrl?: string; crop?: CropRect | null }[] = [];
    const photoCrops: Record<string, CropRect> = {};
    for (const p of selectedPhotos) {
      if (p.id) {
        photoIds.push(p.id);
        if (p.crop) photoCrops[p.id] = p.crop;
      } else if (p.publicId) {
        photoUploads.push({ url: p.url, publicId: p.publicId, thumbnailUrl: p.thumbnailUrl ?? undefined, crop: p.crop ?? null });
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
      photoCrops: Object.keys(photoCrops).length > 0 ? photoCrops : undefined,
    };

    try {
      if (isEditing) {
        await updateMilestone.mutateAsync({ id: milestone.id, ...data });
        toast.success("Milestone diperbarui!");
      } else {
        await createMilestone.mutateAsync(data);
        toast.success("Milestone baru ditambahkan!");
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
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
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
            <label htmlFor="milestone-title" className="text-sm font-medium">Judul *</label>
            <input
              id="milestone-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: First Date"
              className="flex h-10 w-full rounded-xl border border-input bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="milestone-date" className="text-sm font-medium">Tanggal *</label>
            <input
              id="milestone-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="milestone-description" className="text-sm font-medium">Deskripsi</label>
            <textarea
              id="milestone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan momen ini..."
              rows={3}
              className="flex w-full resize-none rounded-xl border border-input bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  aria-label={`Icon ${e}`}
                  aria-pressed={icon === e}
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
                  aria-label={`Warna ${c}`}
                  aria-pressed={color === c}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-ring ring-offset-2 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="milestone-location" className="text-sm font-medium">Lokasi</label>
            <input
              id="milestone-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contok: Café Senja, Bandung"
              className="flex h-10 w-full rounded-xl border border-input bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Foto</label>
            {selectedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {selectedPhotos.map((photo) => (
                  <div key={photo.id || photo.publicId} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border md:h-24 md:w-24">
                    <FormThumb src={photo.url} thumb={photo.thumbnailUrl} crop={photo.crop ?? null} />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id || photo.publicId || photo.url)}
                      aria-label="Hapus foto"
                      title="Hapus foto"
                      className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCropTarget({ key: photo.id || photo.publicId || photo.url, src: photo.url })}
                      aria-label={photo.crop ? "Ubah crop" : "Atur crop"}
                      title={photo.crop ? "Ubah crop" : "Atur crop"}
                      className={cn(
                        "absolute bottom-1 right-1 z-10 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-white transition-colors",
                        photo.crop ? "bg-primary hover:bg-primary/80" : "bg-black/70 hover:bg-black/90",
                      )}
                    >
                      <Crop className="h-3 w-3" />
                      {photo.crop ? "Crop ✓" : "Crop"}
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
                disabled={uploadingPhotos || selectedPhotos.length >= 2}
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
                disabled={selectedPhotos.length >= 2}
              >
                <ImagePlus className="h-4 w-4" />
                Pilih dari Galeri
              </Button>
              <span className="w-full text-[11px] text-muted-foreground">
                Max 2 foto.
              </span>
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
                "Tambah"
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

        {cropTarget && (
          <PhotoCropper
            open
            src={getOptimizedImageUrl(cropTarget.src, 2048)}
            aspect={1}
            initialRect={selectedPhotos.find((p) => (p.id || p.publicId) === cropTarget.key)?.crop ?? null}
            title="Crop Foto Milestone"
            onCancel={() => setCropTarget(null)}
            onDone={confirmCrop}
          />
        )}
      </div>
    </div>
  );
}
