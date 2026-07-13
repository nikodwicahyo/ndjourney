"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { usePhotos, useUploadPhotos, useDeletePhoto, useAlbums, useUpdatePhoto } from "@/hooks/usePhotos";
import { useStorageUsage } from "@/hooks/useStorage";
import AlbumManager from "./AlbumManager";
import { Button, StorageUsageBar } from "@/components/ui";
import UploadItem from "./UploadItem";
import { Upload, ImagePlus, Loader2, ChevronDown, FileWarning, Image as ImageIcon, Video, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import dynamic from "next/dynamic";
import type { Photo } from "@/types";
import PhotoCard from "@/components/gallery/PhotoCard";
import { formatBytes, formatTime } from "@/lib/upload-config";
import { toast } from "sonner";

const Lightbox = dynamic(() => import("../gallery/Lightbox"), { ssr: false });

const MAX_FILES = 50;
const SUPPORTED_FORMATS_LABEL = "JPG, PNG, WEBP, HEIC, GIF, MP4, MOV, WEBM, AVI, MKV, OGG, MPEG.";
const ACCEPT_STRING = "image/*,video/*";

const MEDIA_TABS = [
  { key: "", label: "Semua", icon: null },
  { key: "foto", label: "Foto", icon: ImageIcon },
  { key: "video", label: "Video", icon: Video },
] as const;

function hasVideoFiles(files: File[]): boolean {
  return files.some((f) => f.type.startsWith("video/"));
}

function label(files: File[]): string {
  return hasVideoFiles(files) ? "media" : "foto";
}

export interface UploadFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  status: "pending" | "uploading" | "complete" | "error" | "cancelled";
  progress: { loaded: number; total: number; percent: number; speed: number; eta: number };
  error?: string;
  result?: { url: string; publicId: string; secureUrl: string; width: number; height: number; format: string; bytes: number; duration?: number };
}

export default function GalleryManager() {
  const [mediaType, setMediaType] = useState<string | undefined>();
  const [sort, setSort] = useState<string | undefined>();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePhotos({ limit: 30, mediaType, sort });
  const { data: storage } = useStorageUsage();
  const uploadPhotos = useUploadPhotos();
  const deletePhoto = useDeletePhoto();
  const updatePhoto = useUpdatePhoto();
  const [showUploader, setShowUploader] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: albums } = useAlbums();
  const [pendingFiles, setPendingFiles] = useState<UploadFileItem[]>([]);

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[]>([]);
  const lightboxIndexRef = useRef(-1);
  const lightboxPhotosRef = useRef<Photo[]>([]);

  const handlePhotoClick = useCallback((photosList: Photo[], index: number) => {
    lightboxPhotosRef.current = photosList;
    lightboxIndexRef.current = index;
    setLightboxPhotos(photosList);
    setLightboxIndex(index);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    lightboxIndexRef.current = index;
    setLightboxIndex(index);
  }, []);

  const handleLightboxClose = useCallback(() => {
    lightboxIndexRef.current = -1;
    setLightboxIndex(-1);
  }, []);

  const photos = useMemo(() => data?.pages.flatMap((p) => p.data || []) ?? [], [data]);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setFileErrors([]);
    const newFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        errors.push(`${file.name}: Hanya foto dan video yang bisa diupload`);
        continue;
      }
      if (file.size <= 0) {
        errors.push(`${file.name}: File kosong tidak bisa diupload`);
        continue;
      }
      newFiles.push(file);
    }

    if (errors.length > 0) setFileErrors(errors);

    setPendingFiles((prev) => {
      const availableSlots = MAX_FILES - prev.length;
      if (availableSlots <= 0) return prev;
      const filesToAdd = newFiles.slice(0, availableSlots);
      const newItems: UploadFileItem[] = filesToAdd.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        file,
        status: "pending",
        progress: { loaded: 0, total: file.size, percent: 0, speed: 0, eta: 0 },
      }));
      return [...prev, ...newItems];
    });

    e.target.value = "";
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    uploadPhotos.cancelAllUploads();
    setPendingFiles([]);
    setFileErrors([]);
    setIsSubmitting(false);
  }, [uploadPhotos]);

  const handleCancel = useCallback((queueId: string) => {
    uploadPhotos.cancelUpload(queueId);
  }, [uploadPhotos]);

  const handleRetry = useCallback((queueId: string) => {
    uploadPhotos.retryUpload(queueId);
  }, [uploadPhotos]);

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await uploadPhotos.uploadFiles(
        pendingFiles.map((u) => u.file),
        selectedAlbumId || undefined
      );

      const successCount = result.uploaded.length;
      const failCount = result.failed.length;
      const l = label(pendingFiles.map((u) => u.file));

      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount} ${l} berhasil diupload! 💕`);
        setPendingFiles([]);
        setFileErrors([]);
        setShowUploader(false);
      } else if (successCount > 0 && failCount > 0) {
        toast.success(`${successCount} ${l} berhasil diupload`);
        toast.error(`${failCount} ${l} gagal`);
        const failedNames = new Set(result.failed.map((f) => f.name));
        setPendingFiles((prev) =>
          prev
            .filter((u) => failedNames.has(u.file.name))
            .map((u) => ({
              ...u,
              status: "error",
              error: result.failed.find((f) => f.name === u.file.name)?.error || "Upload failed",
            }))
        );
        setFileErrors([]);
      } else {
        toast.error(`Semua ${l} gagal diupload`);
        setPendingFiles((prev) =>
          prev.map((u) => ({
            ...u,
            status: "error",
            error: result.failed.find((f) => f.name === u.file.name)?.error || "Upload failed",
          }))
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Gagal upload`);
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingFiles, selectedAlbumId, uploadPhotos, isSubmitting]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await showDeleteConfirm({ title: "Hapus Media", text: "Apakah Anda yakin ingin menghapus media ini?" });
    if (confirmed) {
      deletePhoto.mutate(id, {
        onSuccess: () => {
          const currentPhotos = lightboxPhotosRef.current;
          const deletedIndex = currentPhotos.findIndex((photo) => photo.id === id);
          const remainingPhotos = currentPhotos.filter((photo) => photo.id !== id);

          if (deletedIndex !== -1) {
            const currentIndex = lightboxIndexRef.current;
            const nextIndex = remainingPhotos.length === 0
              ? -1
              : deletedIndex < currentIndex
                ? currentIndex - 1
                : Math.min(currentIndex, remainingPhotos.length - 1);

            lightboxPhotosRef.current = remainingPhotos;
            lightboxIndexRef.current = nextIndex;
            setLightboxPhotos(remainingPhotos);
            setLightboxIndex(nextIndex);
          }
          toast.success("Media dihapus");
        },
        onError: () => toast.error("Gagal menghapus media"),
      });
    }
  }, [deletePhoto]);

  const uploadQueue = useMemo(() => {
    if (!isSubmitting) return pendingFiles;
    return uploadPhotos.queue.map((q) => ({
      id: q.id,
      file: q.file,
      status: q.status,
      progress: q.progress,
      error: q.error,
      result: q.result,
    })) as UploadFileItem[];
  }, [isSubmitting, pendingFiles, uploadPhotos.queue]);

  const pendingCount = pendingFiles.length;
  const uploadingCount = uploadQueue.filter((u) => u.status === "uploading").length;
  const completeCount = uploadQueue.filter((u) => u.status === "complete").length;
  const errorCount = uploadQueue.filter((u) => u.status === "error").length;
  const totalCount = uploadQueue.length;

  const overallProgress = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;
  const totalSpeed = useMemo(() => uploadQueue.reduce((sum, u) => sum + (u.progress.speed || 0), 0), [uploadQueue]);
  const uploadingItems = useMemo(() => uploadQueue.filter((u) => u.status === "uploading"), [uploadQueue]);
  const avgEta = uploadingItems.length > 0
    ? Math.round(uploadingItems.reduce((sum, u) => sum + u.progress.eta, 0) / uploadingItems.length)
    : 0;

  return (
    <div className="space-y-8">
      {storage && (
        <StorageUsageBar used={storage.storageUsed} limit={storage.storageLimit} resourcesCount={storage.resourcesCount} />
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Upload Foto & Video</h2>
          <Button
            size="sm"
            onClick={() => {
              const closing = showUploader;
              setShowUploader(!showUploader);
              if (closing) clearQueue();
            }}
            className="gap-2 relative"
          >
            <ImagePlus className="h-4 w-4" />
            {showUploader ? "Tutup" : "Upload"}
            {totalCount > 0 && !showUploader && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </Button>
        </div>

        {showUploader && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            {uploadQueue.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 text-left">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-2 min-w-12 flex-1 max-w-xs overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${overallProgress}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-xs font-medium text-primary sm:text-sm">
                      {completeCount}/{totalCount} file {uploadingCount > 0 ? `(${uploadingCount} uploading)` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:shrink-0">
                    {errorCount > 0 && <span className="text-xs text-destructive">{errorCount} error</span>}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {totalSpeed > 0 ? `${formatBytes(totalSpeed)}/s` : "Menunggu..."}
                    </span>
                    {avgEta > 0 && <span className="text-xs text-muted-foreground whitespace-nowrap">ETA: {formatTime(avgEta)}</span>}
                  </div>
                </div>
              </div>
            )}

            {albums && albums.length > 0 && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring justify-center"
                >
                  <option value="">Tanpa album</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_STRING}
              multiple
              onChange={handleFilesSelected}
              disabled={isSubmitting}
              className="hidden"
              id="gallery-upload-input"
            />

            <label
              htmlFor="gallery-upload-input"
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors w-full",
                isSubmitting ? "pointer-events-none opacity-50" : "hover:border-primary/50 hover:bg-accent"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium">
                  {isSubmitting ? "Mengupload..." : "Klik untuk pilih media"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {SUPPORTED_FORMATS_LABEL} (Maks {MAX_FILES} file per upload)
                </p>
              </div>
            </label>

            {uploadQueue.length > 0 && (
              <div className="mt-4 space-y-2 text-left">
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {uploadQueue.map((item) => (
                    <UploadItem
                      key={item.id}
                      item={item}
                      onCancel={handleCancel}
                      onRetry={handleRetry}
                      onRemove={removeFile}
                      isUploading={isSubmitting}
                    />
                  ))}
                </div>
              </div>
            )}

            {fileErrors.length > 0 && (
              <div className="mt-3 space-y-1 text-left">
                {fileErrors.map((err, i) => (
                  <p key={i} className="flex items-center gap-1.5 text-xs text-destructive">
                    <FileWarning className="h-3 w-3" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            {uploadQueue.length > 0 && (
              <div className="mt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={clearQueue} disabled={isSubmitting}>
                  Hapus semua
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={isSubmitting || pendingCount === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <AlbumManager />
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold">Semua Media ({photos.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              {MEDIA_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMediaType(key || undefined)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    (mediaType || "") === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSort(sort === "oldest" ? undefined : "oldest")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                sort === "oldest" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sort === "oldest" ? "Terlama" : "Terbaru"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ImagePlus className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada media</p>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
              {photos.map((photo, index) => (
                <div key={photo.id} className="mb-3 break-inside-avoid">
                  <PhotoCard
                    photo={photo}
                    onClick={(p) => handlePhotoClick(photos, index)}
                    onFavoriteToggle={(id, isFavorite) => updatePhoto.mutate({ id, isFavorite })}
                    isPrioritized={index < 8}
                  />
                </div>
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                  Muat lebih banyak
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Lightbox
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
        onDelete={handleDelete}
        showAlbumMove={true}
      />
    </div>
  );
}
