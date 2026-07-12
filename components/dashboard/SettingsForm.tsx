"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useCoupleConfig } from "@/hooks/useDashboard";
import { Button, Skeleton } from "@/components/ui";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api } from "@/lib/api-client";
import { Loader2, Save, Upload, X, Cake } from "lucide-react";
import { toast } from "sonner";
import { getJakartaDateOnly } from "@/lib/date";

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
  const heroInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

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
      setSpotifyPlaylistUrl(config.spotifyPlaylistUrl || "");
      setBackgroundMusicUrl(config.backgroundMusicUrl || "");
    }
  }, [config]);

  async function handleUploadMusic(file: File) {
    setUploadingMusic(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Gagal upload musik");
        return;
      }

      const { data } = await res.json();
      setBackgroundMusicUrl(data.secureUrl);
      toast.success("Musik latar berhasil diupload!");
    } catch {
      toast.error("Gagal upload musik");
    } finally {
      setUploadingMusic(false);
    }
  }

  async function handleUploadHero(file: File) {
    setUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Gagal upload foto");
        return;
      }

      const { data } = await res.json();
      setHeroPhotoUrl(data.secureUrl);
      toast.success("Foto pada beranda berhasil diupload!");
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      setUploadingHero(false);
    }
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
        heroPhotoUrl: heroPhotoUrl.trim() || undefined,
        spotifyPlaylistUrl: spotifyPlaylistUrl.trim() || undefined,
        backgroundMusicUrl: backgroundMusicUrl.trim() || undefined,
      });

      if (error) {
        toast.error(error);
        return;
      }

      qc.invalidateQueries({ queryKey: queryKeys.couple.config() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      toast.success("Pengaturan disimpan! 💕");
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
          <label className="text-sm font-medium">Nama Pasangan 1</label>
          <input
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Nama kamu"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <label className="text-sm font-medium">Nama Pasangan 2</label>
          <input
            value={name2}
            onChange={(e) => setName2(e.target.value)}
            className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Nama pasangan"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tanggal Anniversary</label>
        <input
          type="date"
          value={anniversaryDate}
          onChange={(e) => setAnniversaryDate(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 min-w-0">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Cake className="h-3.5 w-3.5 shrink-0 text-secondary" />
            <span className="truncate">Tanggal Lahir {name1 || "Pasangan 1"}</span>
          </label>
          <input
            type="date"
            value={birthDate1}
            onChange={(e) => setBirthDate1(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2 min-w-0">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Cake className="h-3.5 w-3.5 shrink-0 text-secondary" />
            <span className="truncate">Tanggal Lahir {name2 || "Pasangan 2"}</span>
          </label>
          <input
            type="date"
            value={birthDate2}
            onChange={(e) => setBirthDate2(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tagline</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Contoh: Dua hati, satu cerita"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Foto Beranda</label>
        {heroPhotoUrl ? (
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
            <Image
              src={heroPhotoUrl}
              alt="Hero"
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              fetchPriority="low"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => setHeroPhotoUrl("")}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1 transition-colors hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => heroInputRef.current?.click()}
            disabled={uploadingHero}
            className="flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/50 transition-colors hover:bg-muted overflow-hidden px-4"
          >
            {uploadingHero ? (
              <Loader2 className="h-6 w-6 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-6 w-6 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">
                  Klik untuk upload foto pada beranda (jpg, png, webp)
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={heroInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadHero(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">URL Spotify Playlist</label>
        <input
          value={spotifyPlaylistUrl}
          onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="https://open.spotify.com/playlist/..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Background Music (MP3)</label>
        {backgroundMusicUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 overflow-hidden">
            <audio controls className="h-9 min-w-0 flex-1">
              <source src={backgroundMusicUrl} type="audio/mpeg" />
            </audio>
            <button
              type="button"
              onClick={() => setBackgroundMusicUrl("")}
              className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
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
