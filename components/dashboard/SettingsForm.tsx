"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useCoupleConfig } from "@/hooks/useDashboard";
import { Button, Skeleton } from "@/components/ui";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api } from "@/lib/api-client";
import { Loader2, Save, Upload, X, Cake, ImagePlus, Crop } from "lucide-react";
import { toast } from "sonner";
import { uploadFileSimple } from "@/lib/chunked-upload";
import { getJakartaDateOnly } from "@/lib/date";
import { isVideoUrl } from "@/lib/utils";
import { parseCropRect, cropCoverStyle, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { showDeleteConfirm } from "@/lib/swal";
import GalleryPicker from "@/components/ui/GalleryPicker";
import PhotoCropper from "@/components/ui/PhotoCropper";

export default function SettingsForm() {
  const { data: config, isLoading } = useCoupleConfig();
  const qc = useQueryClient();

  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [birthDate1, setBirthDate1] = useState("");
  const [birthDate2, setBirthDate2] = useState("");
  const [tagline, setTagline] = useState("");
  const [heroPhotoUrl, setHeroPhotoUrl] = useState("");
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState("");
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  // crop is coordinates over the ORIGINAL — no copy is ever produced.
  const [heroCrop, setHeroCrop] = useState<CropRect | null>(null);
  const [cropTarget, setCropTarget] = useState<{ src: string; file?: File; recrop?: boolean } | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  // 16:9 mini-hero preview, same crop math as homepage — no extra file.
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewFrame, setPreviewFrame] = useState<{ w: number; h: number } | null>(null);
  const [previewNat, setPreviewNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !heroPhotoUrl) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) setPreviewFrame({ w: r.width, h: (r.width * 9) / 16 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heroPhotoUrl]);

  useEffect(() => { setPreviewNat(null); }, [heroPhotoUrl]);

  const previewStyle = heroCrop && previewNat && previewFrame
    ? cropCoverStyle(previewNat.w, previewNat.h, previewFrame.w, previewFrame.h, heroCrop)
    : null;

  useEffect(() => {
    if (config) {
      setName1(config.name1 || "");
      setName2(config.name2 || "");
      setAnniversaryDate(
        config.anniversaryDate
          ? getJakartaDateOnly(config.anniversaryDate)
          : "",
      );
      setBirthDate1(
        config.birthDate1
          ? getJakartaDateOnly(config.birthDate1)
          : "",
      );
      setBirthDate2(
        config.birthDate2
          ? getJakartaDateOnly(config.birthDate2)
          : "",
      );
      setTagline(config.tagline || "");
      setHeroPhotoUrl(config.heroPhotoUrl || "");
      setHeroCrop(parseCropRect((config as { heroCrop?: unknown }).heroCrop));
      setSpotifyPlaylistUrl(config.spotifyPlaylistUrl || "");
      setBackgroundMusicUrl(config.backgroundMusicUrl || "");
    }
  }, [config]);

  async function handleUploadMusic(file: File) {
    setUploadingMusic(true);
    try {
      const result = await uploadFileSimple(file, () => {});
      setBackgroundMusicUrl(result.url);
      toast.success("Musik latar berhasil diupload!");
    } catch {
      toast.error("Gagal upload musik");
    } finally {
      setUploadingMusic(false);
    }
  }

  /** Stage a fresh file into the cropper — upload happens only on confirm. */
  function stageHeroFile(file: File) {
    if (cropTarget?.file) URL.revokeObjectURL(cropTarget.src);
    setCropTarget({ src: URL.createObjectURL(file), file });
  }

  function selectGalleryHero(photo: { id: string; url: string; thumbnailUrl: string | null }) {
    if (cropTarget?.file) URL.revokeObjectURL(cropTarget.src);
    // Gallery original is referenced, never copied or re-uploaded.
    setCropTarget({ src: photo.url });
    setShowGalleryPicker(false);
  }

  function closeCropper() {
    if (cropTarget?.file) URL.revokeObjectURL(cropTarget.src);
    setCropTarget(null);
  }

  async function confirmHeroCrop(rect: CropRect) {
    const target = cropTarget;
    if (!target) return;
    const isFull = rect.x <= 0 && rect.y <= 0 && rect.w >= 1 && rect.h >= 1;
    if (target.file) {
      setUploadingHero(true);
      try {
        const result = await uploadFileSimple(target.file, () => {});
        setHeroPhotoUrl(result.url);
        setHeroCrop(isFull ? null : rect);
        toast.success("Foto pada beranda berhasil diupload!");
      } catch {
        toast.error("Gagal upload foto");
      } finally {
        setUploadingHero(false);
      }
      URL.revokeObjectURL(target.src);
    } else {
      setHeroPhotoUrl(target.src);
      setHeroCrop(isFull ? null : rect);
    }
    setCropTarget(null);
  }

  function dateOrUndefined(dateStr: string): string | undefined {
    if (!dateStr) return undefined;
    return dateStr;
  }

  function dateOrNull(dateStr: string): string | null | undefined {
    if (dateStr === "") return null;
    return dateStr;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await api.put("/api/couple", {
        name1: name1.trim(),
        name2: name2.trim(),
        anniversaryDate: dateOrUndefined(anniversaryDate),
        birthDate1: dateOrNull(birthDate1),
        birthDate2: dateOrNull(birthDate2),
        tagline: tagline.trim() || undefined,
        // explicit null clears (undefined would silently keep the old value).
        heroPhotoUrl: heroPhotoUrl.trim() || null,
        heroCrop: heroPhotoUrl.trim() ? (heroCrop ?? null) : null,
        spotifyPlaylistUrl: spotifyPlaylistUrl.trim() || undefined,
        backgroundMusicUrl: backgroundMusicUrl.trim() || undefined,
      });

      if (error) {
        toast.error(error);
        return;
      }

      qc.invalidateQueries({ queryKey: queryKeys.couple.config() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      toast.success("Pengaturan disimpan!");
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-xl space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 min-w-0">
          <label htmlFor="settings-name1" className="text-sm font-medium">Nama Pasangan 1</label>
          <input
            id="settings-name1"
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Nama kamu"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <label htmlFor="settings-name2" className="text-sm font-medium">Nama Pasangan 2</label>
          <input
            id="settings-name2"
            value={name2}
            onChange={(e) => setName2(e.target.value)}
            className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Nama pasangan"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-anniversary" className="text-sm font-medium">Tanggal Anniversary</label>
        <input
          id="settings-anniversary"
          type="date"
          value={anniversaryDate}
          onChange={(e) => setAnniversaryDate(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 min-w-0">
          <label htmlFor="settings-birth1" className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">Tanggal Lahir {name1 || "Pasangan 1"}</span>
          </label>
          <input
            id="settings-birth1"
            type="date"
            value={birthDate1}
            onChange={(e) => setBirthDate1(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <label htmlFor="settings-birth2" className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">Tanggal Lahir {name2 || "Pasangan 2"}</span>
          </label>
          <input
            id="settings-birth2"
            type="date"
            value={birthDate2}
            onChange={(e) => setBirthDate2(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-tagline" className="text-sm font-medium">Tagline</label>
        <input
          id="settings-tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Contoh: Dua hati, satu cerita"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-hero" className="text-sm font-medium">Foto Beranda</label>
        {heroPhotoUrl ? (
          <div className="relative w-full">
            <div ref={previewRef} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
              {previewStyle ? (
                <Image
                  src={getOptimizedImageUrl(heroPhotoUrl, 1600)}
                  alt="Hero"
                  width={Math.round(previewStyle.width)}
                  height={Math.round(previewStyle.height)}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setPreviewNat({ w: img.naturalWidth, h: img.naturalHeight });
                    }
                  }}
                  className="absolute max-w-none"
                  style={{ left: previewStyle.left, top: previewStyle.top }}
                  sizes="(max-width: 672px) 100vw, 672px"
                />
              ) : (
                <Image
                  src={getOptimizedImageUrl(heroPhotoUrl, 1600)}
                  alt="Hero"
                  fill
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setPreviewNat({ w: img.naturalWidth, h: img.naturalHeight });
                    }
                  }}
                  className="object-cover"
                  sizes="(max-width: 672px) 100vw, 672px"
                />
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await showDeleteConfirm({ title: "Hapus Foto Beranda", text: "Apakah Anda yakin ingin menghapus foto beranda?" });
                if (ok) { setHeroPhotoUrl(""); setHeroCrop(null); }
              }}
              aria-label="Hapus foto beranda"
              className="absolute right-2 top-2 rounded-full bg-background/80 p-2.5 transition-colors hover:bg-background"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/50 px-4">
            <Upload className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground text-center">
              Foto pada beranda yang tampil di halaman utama. <br />
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => heroInputRef.current?.click()}
            disabled={uploadingHero}
          >
            {uploadingHero ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            Upload Foto Baru
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowGalleryPicker(true)}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            Pilih dari Galeri
          </Button>
          {heroPhotoUrl && !isVideoUrl(heroPhotoUrl) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCropTarget({ src: heroPhotoUrl, recrop: true })}
            >
              <Crop className="h-4 w-4" aria-hidden="true" />
              {heroCrop ? "Ubah Crop" : "Atur Crop"}
            </Button>
          )}
        </div>
        <input
          ref={heroInputRef}
          id="settings-hero"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) stageHeroFile(file);
            e.target.value = "";
          }}
        />
        {showGalleryPicker && (
          <GalleryPicker
            open={showGalleryPicker}
            onClose={() => setShowGalleryPicker(false)}
            onSelect={selectGalleryHero}
          />
        )}
        {cropTarget && (
          <PhotoCropper
            open
            src={getOptimizedImageUrl(cropTarget.src, 2048)}
            aspect={16 / 9}
            initialRect={cropTarget.recrop ? heroCrop : null}
            guide="phone"
            title="Crop Foto Beranda"
            onCancel={closeCropper}
            onDone={confirmHeroCrop}
          />
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-spotify" className="text-sm font-medium">URL Spotify Playlist</label>
        <input
          id="settings-spotify"
          value={spotifyPlaylistUrl}
          onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="https://open.spotify.com/playlist/..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-music" className="text-sm font-medium">Background Music (MP3)</label>
        {backgroundMusicUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 overflow-hidden">
            <audio controls className="h-9 min-w-0 flex-1">
              <source src={backgroundMusicUrl} type="audio/mpeg" />
            </audio>
            <button
              type="button"
              onClick={async () => {
                const ok = await showDeleteConfirm({ title: "Hapus Musik Latar", text: "Apakah Anda yakin ingin menghapus musik latar?" });
                if (ok) setBackgroundMusicUrl("");
              }}
              className="shrink-0 rounded-full p-2.5 transition-colors hover:bg-muted"
              aria-label="Hapus musik latar"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            disabled={uploadingMusic}
            className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-input bg-muted/50 transition-colors hover:bg-muted overflow-hidden px-4"
          >
            {uploadingMusic ? (
              <Loader2 className="h-5 w-5 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center">
                  Upload file MP3 (max 20MB)
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={musicInputRef}
          id="settings-music"
          type="file"
          accept="audio/mpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadMusic(file);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">
          Musik akan play otomatis saat halaman dibuka pada interaksi pertama.
        </p>
      </div>

      <Button type="submit" className="w-full gap-2 sm:w-auto" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Menyimpan...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 shrink-0" />
            Simpan Pengaturan
          </>
        )}
      </Button>
    </form>
  );
}
