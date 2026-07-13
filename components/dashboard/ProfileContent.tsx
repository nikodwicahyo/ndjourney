"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Heart, Mail, CalendarDays, Quote, Cake, Loader2, Upload, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { uploadFileSimple } from "@/lib/chunked-upload";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setEditName(displayName);
    setEditImage(displayImage);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setUploading(false);
  }

  async function handleUploadAvatar(file: File) {
    setUploading(true);
    try {
      const result = await uploadFileSimple(file, () => {});
      setEditImage(result.url);
      toast.success("Foto profil berhasil diupload!");
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }

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

      await update();

      setDisplayName(editName.trim());
      setDisplayImage(editImage);

      toast.success("Profil berhasil diperbarui! 💕");
      setShowModal(false);
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
            <Mail className="h-3.5 w-3.5 shrink-0" />
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
            <Heart className="h-5 w-5 shrink-0 fill-primary text-primary" />
            <span className="truncate">{couple.name1} & {couple.name2}</span>
          </h2>
          {couple.tagline && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Quote className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{couple.tagline}</span>
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Anniversary: {formatDate(couple.anniversaryDate)}</span>
          </p>
          {couple.birthDate1 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cake className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Ultah {couple.name1}: {formatDate(couple.birthDate1)}</span>
            </p>
          )}
          {couple.birthDate2 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cake className="h-3.5 w-3.5 shrink-0" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">
                Edit Profil
              </h2>
              <button
                onClick={closeModal}
                className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
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
                    if (file) handleUploadAvatar(file);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Klik foto untuk mengganti
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nama</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Nama kamu"
                  autoFocus
                  maxLength={100}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  onClick={handleSave}
                  disabled={saving}
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
    </div>
  );
}
