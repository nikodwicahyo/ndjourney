"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Heart, Mail, CalendarDays, Quote, Cake, Loader2, Upload, X, Pencil, Crop } from "lucide-react";
import { Button, PhotoCropper } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { uploadFileSimple } from "@/lib/chunked-upload";
import { resolveUploadMime, validateFileSize } from "@/lib/upload-config";
import { cropImageFile, isFullCrop, type CropRect } from "@/lib/image-crop";
import { toast } from "sonner";

type ProfileContentProps = {
  user: {
    name: string;
    email: string;
    image: string | null;
    role: string;
  };
  couple: {
    name1: string;
    name2: string;
    anniversaryDate: string;
    birthDate1?: string | null;
    birthDate2?: string | null;
    tagline: string | null;
  } | null;
};

export default function ProfileContent({ user, couple }: ProfileContentProps) {
  const { update } = useSession();

  const [displayName, setDisplayName] = useState(user.name);
  const [displayImage, setDisplayImage] = useState<string | null>(user.image);

  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editImage, setEditImage] = useState<string | null>(user.image);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Staged crop source: fresh picks carry their File; recrops of the saved
  // avatar reference its URL and are fetched only on confirm (no re-upload
  // when the user just opens and cancels the cropper).
  const [cropTarget, setCropTarget] = useState<{ src: string; file?: File } | null>(null);
  const ownedUrlRef = useRef<string | null>(null);
  // Bake memory: the UN-baked source + last rect, so recrop reopens at the
  // exact position (re-baked from the original, no generational loss).
  // Scoped to the image it produced via forImage; dropped when stale.
  // ponytail: holds one image File in memory, revoked on replace/unmount.
  const [cropMemory, setCropMemory] = useState<{
    src: string;
    file?: File;
    rect: CropRect | null;
    forImage: string;
  } | null>(null);
  const memoryUrlRef = useRef<string | null>(null);

  // Revoke the object URLs we own — never a remote URL.
  useEffect(() => {
    return () => {
      if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
      if (memoryUrlRef.current) URL.revokeObjectURL(memoryUrlRef.current);
    };
  }, []);

  function setOwnedTarget(next: { src: string; file?: File } | null) {
    if (ownedUrlRef.current) {
      URL.revokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = null;
    }
    if (next?.file) ownedUrlRef.current = next.src;
    setCropTarget(next);
  }

  function dropMemory() {
    if (memoryUrlRef.current) {
      URL.revokeObjectURL(memoryUrlRef.current);
      memoryUrlRef.current = null;
    }
    setCropMemory(null);
  }

  function openModal() {
    setEditName(displayName);
    setEditImage(displayImage);
    // Memory belongs to the image it produced — a discarded unsaved upload
    // takes its memory with it.
    if (cropMemory && cropMemory.forImage !== displayImage) dropMemory();
    setShowModal(true);
  }

  function closeModal() {
    setOwnedTarget(null);
    setShowModal(false);
    setUploading(false);
  }

  function closeCropper() {
    setOwnedTarget(null);
  }

  /** Validate, then stage into the 1:1 cropper — upload happens on confirm. */
  function stageAvatarFile(file: File) {
    if (!resolveUploadMime(file.name, file.type).startsWith("image/")) {
      toast.error("Pilih file gambar yang valid");
      return;
    }
    if (file.size === 0) {
      toast.error("File gambar kosong");
      return;
    }
    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      toast.error(sizeCheck.error ?? "File terlalu besar");
      return;
    }
    // New photo → fresh position; its own memory starts at first confirm.
    dropMemory();
    setOwnedTarget({ src: URL.createObjectURL(file), file });
  }

  /** Recrop: reopens on the un-baked source at the last position when known. */
  function openRecrop() {
    if (uploading || cropTarget) return;
    if (cropMemory && cropMemory.forImage === editImage) {
      // Same src the memory owns — staged without taking ownership, so
      // cancelling never revokes the retained source.
      setCropTarget({ src: cropMemory.src, file: cropMemory.file });
      return;
    }
    if (!editImage) {
      fileInputRef.current?.click();
      return;
    }
    setCropTarget({ src: editImage });
  }

  async function fileFromUrl(url: string): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not-an-image");
    const name = url.split("?")[0].split("/").pop() || "avatar";
    return new File([blob], name, { type: blob.type });
  }

  async function confirmCrop(rect: CropRect) {
    const target = cropTarget;
    if (!target || uploading) return;
    setUploading(true);
    try {
      let source: File;
      try {
        source = target.file ?? (await fileFromUrl(target.src));
      } catch {
        toast.error("Gagal memuat foto untuk crop ulang");
        return;
      }
      const sizeCheck = validateFileSize(source);
      if (!sizeCheck.valid) {
        toast.error(sizeCheck.error ?? "File terlalu besar");
        return;
      }
      const full = isFullCrop(rect);
      const toUpload = full ? source : await cropImageFile(source, rect);
      const result = await uploadFileSimple(toUpload, () => {});
      setEditImage(result.url);
      toast.success("Crop diterapkan! Klik Simpan untuk menyimpan.");
      // Retain the un-baked source so the next recrop restores position.
      if (cropMemory && target.src === cropMemory.src) {
        setCropMemory({ ...cropMemory, file: source, rect: full ? null : rect, forImage: result.url });
      } else {
        dropMemory();
        if (target.file) {
          // Take over the staged URL instead of revoking + re-creating it.
          memoryUrlRef.current = ownedUrlRef.current;
          ownedUrlRef.current = null;
          setCropMemory({ src: target.src, file: target.file, rect: full ? null : rect, forImage: result.url });
        } else {
          const url = URL.createObjectURL(source);
          memoryUrlRef.current = url;
          setCropMemory({ src: url, file: source, rect: full ? null : rect, forImage: result.url });
        }
      }
      setCropTarget(null);
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      toast.error("Nama wajib diisi");
      setNameError("Nama wajib diisi");
      return;
    }
    setNameError("");

    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: editName.trim() };
      if (editImage !== displayImage) {
        body.image = editImage;
      }

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan profil");
        return;
      }

      // Local state first: the page reflects the save even if the session
      // refresh below fails — a stale Navbar must never mask a good save.
      const nextName = editName.trim();
      setDisplayName(nextName);
      setDisplayImage(editImage);
      setShowModal(false);
      toast.success("Profil berhasil diperbarui!");
      try {
        // Data is required: bare update() is a GET that never fires the jwt
        // "update" trigger, leaving the token (Navbar/Sidebar/refresh) stale
        // until re-login. POSTing re-stamps the token from the DB (see the
        // jwt callback) and re-cookies it, so refresh stays correct.
        const refreshed = await update({
          user: { name: nextName, email: user.email, image: editImage },
        });
        // update() swallows fetch failures as null (no throw) — verify the
        // token actually carries the new photo, or refresh would revert.
        if (!refreshed || refreshed.user?.image !== editImage) {
          toast.warning("Profil tersimpan, tetapi foto di menu belum segar. Login ulang untuk menyegarkannya.");
        }
      } catch {
        // Session catches up on next login; this page is already correct.
      }
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-8">
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-primary/20">
          {displayImage ? (
            <Image src={displayImage} alt={displayName} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
              {displayName.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl truncate">{displayName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{user.email}</span>
          </div>
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
            {user.role === "ADMIN" ? "Admin" : "Partner"}
          </span>
        </div>
      </div>

      {couple && (
        <div className="rounded-2xl border border-border bg-card p-6 overflow-hidden">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Heart className="h-5 w-5 shrink-0 fill-primary text-primary" aria-hidden="true" />
            <span className="truncate">{couple.name1} & {couple.name2}</span>
          </h2>
          {couple.tagline && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Quote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{couple.tagline}</span>
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Anniversary: {formatDate(couple.anniversaryDate)}</span>
          </p>
          {couple.birthDate1 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Ultah {couple.name1}: {formatDate(couple.birthDate1)}</span>
            </p>
          )}
          {couple.birthDate2 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Ultah {couple.name2}: {formatDate(couple.birthDate2)}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" className="gap-2" onClick={openModal}>
          <Pencil className="h-4 w-4 shrink-0" />
          Edit Profil
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 max-sm:items-end">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto max-sm:max-w-full max-sm:rounded-b-none">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-heading text-lg font-semibold">
                Edit Profil
              </h2>
              <button
                onClick={closeModal}
                aria-label="Tutup"
                className="shrink-0 rounded-full p-2.5 transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Ubah foto profil"
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary/20 transition-opacity hover:opacity-80"
                >
                  {editImage ? (
                    <Image
                      src={editImage}
                      alt={editName}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/10 text-3xl font-bold text-primary">
                      {editName.charAt(0)}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <Upload className="h-5 w-5 text-white" />
                    )}
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) stageAvatarFile(file);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Klik foto untuk mengganti
                </p>
                {editImage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={openRecrop}
                    disabled={uploading}
                  >
                    <Crop className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Atur Crop
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="profile-name" className="text-sm font-medium">Nama</label>
                <input
                  id="profile-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Nama kamu"
                  autoFocus
                  maxLength={100}
                  aria-invalid={!!nameError}
                />
                {nameError && (
                  <p role="alert" className="text-xs text-destructive">{nameError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={saving || uploading}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  onClick={handleSave}
                  disabled={saving || uploading}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cropTarget && (
        <PhotoCropper
          open
          src={cropTarget.src}
          aspect={1}
          initialRect={
            cropMemory && cropTarget.src === cropMemory.src ? cropMemory.rect : null
          }
          title="Crop Foto Profil"
          onCancel={closeCropper}
          onDone={confirmCrop}
          busy={uploading}
        />
      )}
    </div>
  );
}
