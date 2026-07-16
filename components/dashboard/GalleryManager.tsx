"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePhotos, useUploadPhotos, useDeletePhoto, useAlbums, useUpdatePhoto } from "@/hooks/usePhotos";
import { useStorageUsage } from "@/hooks/useStorage";
import AlbumManager from "./AlbumManager";
import { Button, StorageUsageBar } from "@/components/ui";
import UploadItem from "./UploadItem";
import { Upload, ImagePlus, Loader2, FileWarning, Image as ImageIcon, Video, ArrowUpDown, Trash2, CheckSquare, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { showDeleteConfirm } from "@/lib/swal";
import dynamic from "next/dynamic";
import type { Photo } from "@/types";
import PhotoCard from "@/components/gallery/PhotoCard";
import { formatBytes, formatTime, getMaxFileSize } from "@/lib/upload-config";
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
  const [albumFilter, setAlbumFilter] = useState<string | undefined>();
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePhotos({ limit: 30, mediaType, sort, albumId: albumFilter, isFavorite: favoriteFilter || undefined });
  const { data: storage, refetch: refetchStorage, isFetching: isFetchingStorage } = useStorageUsage();
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
  const lightboxIndexRef = useRef(-1);

  const handlePhotoClick = useCallback((photosList: Photo[], index: number) => {
    lightboxIndexRef.current = index;
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

  const queryClient = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const photos = useMemo(() => data?.pages.flatMap((p) => p.data || []) ?? [], [data]);

  const [colCount, setColCount] = useState(2);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1024) setColCount(4);
      else if (w >= 768) setColCount(3);
      else setColCount(2);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mediaType, sort, albumFilter, favoriteFilter]);

  const toReadingOrder = useCallback(function <T>(items: T[], cols: number) {
    const rows = Math.ceil(items.length / cols);
    const result: T[] = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const idx = row * cols + col;
        if (idx < items.length) result.push(items[idx]);
      }
    }
    return result;
  }, []);

  const orderedPhotos = useMemo(
    () => toReadingOrder(photos, colCount) as Photo[],
    [photos, colCount, toReadingOrder],
  );

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    const confirmed = await showDeleteConfirm({
      title: "Hapus Media",
      text: `Apakah Anda yakin ingin menghapus ${count} media?`,
    });
    if (!confirmed) return;
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const r = await fetch(`/api/photos/${id}`, { method: "DELETE" });
        if (!r.ok) {
          let message = "Gagal menghapus media";
          try {
            const body = await r.json();
            if (body?.error) message = body.error;
          } catch {
            // ignore parse errors
          }
          if (r.status === 403) message = "Kamu tidak punya akses untuk menghapus media ini";
          else if (r.status === 404) message = "Media tidak ditemukan atau sudah dihapus";
          else if (r.status === 429) message = "Terlalu banyak permintaan, coba lagi nanti";
          throw new Error(message);
        }
      }),
    );
    const failed = results.filter((r) => r.status === "rejected");
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0) {
      toast.success(`${succeeded} media dihapus`);
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["storage", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "activity"] });
    }
    if (failed.length > 0) {
      const reason = failed[0].status === "rejected" ? (failed[0].reason as Error)?.message : "";
      const allSame = failed.every(
        (f) => f.status === "rejected" && (f.reason as Error)?.message === reason,
      );
      toast.error(
        allSame && reason
          ? `${failed.length} media gagal dihapus: ${reason}`
          : `${failed.length} media gagal dihapus`,
      );
    }
    clearSelection();
  }, [selectedIds, queryClient, clearSelection]);

  const [moveAlbumId, setMoveAlbumId] = useState("");
  const handleBatchMove = useCallback(async () => {
    if (!moveAlbumId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/photos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albumId: moveAlbumId }),
        }).then((r) => {
          if (!r.ok) throw new Error("Gagal memindahkan");
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    if (succeeded > 0) {
      toast.success(`${succeeded} media dipindahkan`);
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    }
    if (failed > 0) toast.error(`${failed} media gagal dipindahkan`);
    setMoveAlbumId("");
    clearSelection();
  }, [moveAlbumId, selectedIds, queryClient, clearSelection]);

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
      const maxSize = getMaxFileSize(file.type);
      if (file.size > maxSize) {
        errors.push(`${file.name}: Melebihi batas ${formatBytes(maxSize)} (${formatBytes(file.size)})`);
        continue;
      }
      newFiles.push(file);
    }

    if (errors.length > 0) setFileErrors(errors);

    setPendingFiles((prev) => {
      const existingNames = new Set(prev.map((u) => u.file.name));
      const deduped = newFiles.filter((f) => !existingNames.has(f.name));
      const availableSlots = MAX_FILES - prev.length;
      if (availableSlots <= 0) return prev;
      const filesToAdd = deduped.slice(0, availableSlots);
      const newItems: UploadFileItem[] = filesToAdd.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        file,
        status: "pending",
        progress: { loaded: 0, total: file.size, percent: 0, speed: 0, eta: 0 },
      }));
      if (deduped.length < newFiles.length) {
        setFileErrors((prev) => [...prev, `${newFiles.length - deduped.length} file dilewati (nama duplikat)`]);
      }
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
        selectedAlbumId || undefined,
        pendingFiles.map((u) => u.id)
      );

      const successCount = result.uploaded.length;
      const failCount = result.failed.length;
      const l = label(pendingFiles.map((u) => u.file));

      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount} ${l} berhasil diupload! 💕`);
        setPendingFiles([]);
        setFileErrors([]);
        setShowUploader(false);
        if (selectedAlbumId) {
          setAlbumFilter(selectedAlbumId);
        }
      } else if (successCount > 0 && failCount > 0) {
        toast.success(`${successCount} ${l} berhasil diupload`);
        const firstError = result.failed[0]?.error || "";
        const detail = firstError.includes("timeout") ? " (waktu habis)" : firstError.includes("limit") || firstError.includes("exceeds") ? " (melebihi batas)" : "";
        toast.error(`${failCount} ${l} gagal${detail}. Klik tombol retry untuk mencoba lagi.`);
        const failedIds = new Set(result.failed.map((f) => f.id));
        setPendingFiles((prev) =>
          prev
            .filter((u) => failedIds.has(u.id))
            .map((u) => ({
              ...u,
              status: "error",
              error: result.failed.find((f) => f.id === u.id)?.error || "Upload failed",
            }))
        );
        setFileErrors([]);
      } else {
        toast.error(`Semua ${l} gagal diupload`);
        const failedMap = new Map(result.failed.map((f) => [f.id, f]));
        setPendingFiles((prev) =>
          prev.map((u) => ({
            ...u,
            status: "error",
            error: failedMap.get(u.id)?.error || "Upload failed",
          }))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal upload";
      if (msg.includes("timeout")) {
        toast.error("Upload timeout. Coba lagi atau upload file yang lebih kecil.");
      } else if (msg.includes("limit") || msg.includes("exceeds")) {
        toast.error("File melebihi batas ukuran yang diizinkan.");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        toast.error("Koneksi terputus. Periksa koneksi internet Anda.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingFiles, selectedAlbumId, uploadPhotos, isSubmitting]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await showDeleteConfirm({ title: "Hapus Media", text: "Apakah Anda yakin ingin menghapus media ini?" });
    if (confirmed) {
      const idx = lightboxIndexRef.current;
      const total = photos.length;
      deletePhoto.mutate(id, {
        onSuccess: () => {
          if (total <= 1) {
            setLightboxIndex(-1);
            lightboxIndexRef.current = -1;
          } else if (idx >= total - 1) {
            const next = idx - 1;
            lightboxIndexRef.current = next;
            setLightboxIndex(next);
          }
          toast.success("Media dihapus");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus media"),
      });
    }
  }, [deletePhoto, photos.length]);

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

  const pendingCount = uploadQueue.filter((u) => u.status === "pending").length;
  const uploadingCount = uploadQueue.filter((u) => u.status === "uploading").length;
  const completeCount = uploadQueue.filter((u) => u.status === "complete").length;
  const errorCount = uploadQueue.filter((u) => u.status === "error").length;
  const totalCount = uploadQueue.length;

  const totalBytes = uploadQueue.reduce((sum, u) => sum + u.file.size, 0);
  const uploadedBytes = uploadQueue.reduce((sum, u) => {
    if (u.status === "complete" || u.status === "error") return sum + u.file.size;
    return sum + (u.progress.loaded || 0);
  }, 0);
  const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const totalSpeed = useMemo(() => uploadQueue.reduce((sum, u) => sum + (u.progress.speed || 0), 0), [uploadQueue]);
  const uploadingItems = useMemo(() => uploadQueue.filter((u) => u.status === "uploading"), [uploadQueue]);
  const avgEta = uploadingItems.length > 0
    ? Math.round(uploadingItems.reduce((sum, u) => sum + u.progress.eta, 0) / uploadingItems.length)
    : 0;

  return (
    <div className="space-y-8">
      {storage && (
        <StorageUsageBar
          used={storage.storageUsed}
          limit={storage.storageLimit}
          resourcesCount={storage.resourcesCount}
          imagesCount={storage.imagesCount}
          videosCount={storage.videosCount}
          rawCount={storage.rawCount}
          imagesBytes={storage.imagesBytes}
          videosBytes={storage.videosBytes}
          rawBytes={storage.rawBytes}
          onRefresh={() => refetchStorage()}
          isRefreshing={isFetchingStorage}
        />
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
                      {formatBytes(uploadedBytes)}/{formatBytes(totalBytes)} {uploadingCount > 0 ? `(${uploadingCount} mengupload)` : pendingCount > 0 ? `(${pendingCount} antrian)` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:shrink-0">
                    {errorCount > 0 && <span className="text-xs text-destructive">{errorCount} error</span>}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {uploadingCount > 0 ? (totalSpeed > 0 ? `${formatBytes(totalSpeed)}/s` : "Mengupload...") : "Menunggu..."}
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

            {pendingCount > 0 && pendingFiles.some(
              f => f.file.size > getMaxFileSize(f.file.type) * 0.8
            ) && (
              <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                  <FileWarning className="h-3 w-3 shrink-0" />
                  Beberapa file berukuran besar. Upload mungkin memakan waktu lebih lama.
                </p>
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
          <h2 className="font-heading text-lg font-semibold">Gallery ({data?.pages[0]?.total ?? photos.length})</h2>
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
              onClick={() => setFavoriteFilter(!favoriteFilter)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                favoriteFilter
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", favoriteFilter && "fill-primary")} />
              Favorit
            </button>
            {albums && albums.length > 0 && (
              <select
                value={albumFilter ?? ""}
                onChange={(e) => setAlbumFilter(e.target.value || undefined)}
                className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Semua Album</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a._count.photos})</option>
                ))}
              </select>
            )}
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
            <button
              onClick={() => {
                if (selectMode) clearSelection();
                else setSelectMode(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                selectMode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {selectMode ? "Batal" : "Pilih"}
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <span className="text-sm font-medium">{selectedIds.size} media dipilih</span>
            {albums && albums.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={moveAlbumId}
                  onChange={(e) => setMoveAlbumId(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Pindahkan ke album</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleBatchMove}
                  disabled={!moveAlbumId}
                  className="gap-2"
                >
                  Pindahkan
                </Button>
              </div>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Batal
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-3 break-inside-avoid">
                <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-muted" />
              </div>
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
              {orderedPhotos.map((photo) => {
                const origIndex = photos.indexOf(photo);
                return (
                  <div key={photo.id} className="mb-3 break-inside-avoid">
                    <PhotoCard
                      photo={photo}
                      onClick={(p) => handlePhotoClick(photos, origIndex)}
                      onFavoriteToggle={(id, isFavorite) => updatePhoto.mutate({ id, isFavorite })}
                      isPrioritized={origIndex < 8}
                      selectable={selectMode}
                      isSelected={selectedIds.has(photo.id)}
                      onSelectToggle={handleSelectToggle}
                    />
                  </div>
                );
              })}
            </div>

            <div ref={loadMoreRef} className="py-8">
              {isFetchingNextPage && (
                <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="mb-3 break-inside-avoid">
                      <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-muted" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Lightbox
        photos={photos}
        currentIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
        onDelete={handleDelete}
        showAlbumMove={true}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        totalCount={data?.pages[0]?.total ?? photos.length}
      />
    </div>
  );
}
