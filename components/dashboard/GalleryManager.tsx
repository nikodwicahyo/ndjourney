"use client";

import { useState, useCallback, useRef } from "react";
import { usePhotos, useUploadPhotos, useDeletePhoto, useAlbums } from "@/hooks/usePhotos";
import { useStorageUsage } from "@/hooks/useStorage";
import AlbumManager from "./AlbumManager";
import { Button, Skeleton, StorageUsageBar } from "@/components/ui";
import { Upload, Trash2, ImagePlus, Loader2, ChevronDown, X, FileVideo, FileWarning, Play, Image as ImageIcon, Video, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { Photo } from "@/types";

const Lightbox = dynamic(() => import("../gallery/Lightbox"), {
  ssr: false,
});

const MAX_FILES = 10;
const MAX_SIZE_MB = 200;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function hasVideoFiles(files: File[]): boolean {
  return files.some((f) => f.type.startsWith("video/"));
}

function label(files: File[]): string {
  return hasVideoFiles(files) ? "media" : "foto";
}

const MEDIA_TABS = [
  { key: "", label: "Semua", icon: null },
  { key: "foto", label: "Foto", icon: ImageIcon },
  { key: "video", label: "Video", icon: Video },
] as const;

export default function GalleryManager() {
  const [mediaType, setMediaType] = useState<string | undefined>();
  const [sort, setSort] = useState<string | undefined>();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePhotos({ limit: 30, mediaType, sort });
  const { data: storage } = useStorageUsage();
  const uploadPhotos = useUploadPhotos();
  const deletePhoto = useDeletePhoto();
  const [showUploader, setShowUploader] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: albums } = useAlbums();

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[]>([]);

  const handlePhotoClick = useCallback(
    (photosList: Photo[], index: number) => {
      setLightboxPhotos(photosList);
      setLightboxIndex(index);
    },
    [],
  );

  const photos = data?.pages.flatMap((p) => p.data || []) ?? [];

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      setFileErrors([]);
      const newFiles: File[] = [];
      const errors: string[] = [];

      for (const file of Array.from(fileList)) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          errors.push(`${file.name}: Format tidak didukung`);
          continue;
        }
        if (file.size > MAX_SIZE_BYTES) {
          errors.push(`${file.name}: Maksimal ${MAX_SIZE_MB}MB`);
          continue;
        }
        newFiles.push(file);
      }

      if (errors.length > 0) {
        setFileErrors(errors);
      }

      setSelectedFiles((prev) => {
        const combined = [...prev, ...newFiles];
        return combined.slice(0, MAX_FILES);
      });

      e.target.value = "";
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    try {
      const result = await uploadPhotos.mutateAsync({
        files: selectedFiles,
        albumId: selectedAlbumId || undefined,
      });

      const successCount = result.uploaded.length;
      const failCount = result.failed.length;

      const l = label(selectedFiles);
      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount} ${l} berhasil diupload!`);
      } else if (successCount > 0 && failCount > 0) {
        toast.success(`${successCount} ${l} berhasil diupload`);
        toast.error(`${failCount} ${l} gagal: ${result.failed.map((f) => `${f.name} — ${f.error}`).join(", ")}`);
      } else {
        toast.error(`Semua ${l} gagal: ${result.failed.map((f) => `${f.name} — ${f.error}`).join(", ")}`);
      }

      setSelectedFiles([]);
      setFileErrors([]);
      setShowUploader(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Gagal upload ${label(selectedFiles)}`);
    }
  }, [selectedFiles, selectedAlbumId, uploadPhotos]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Hapus media ini?")) {
        deletePhoto.mutate(id, {
          onSuccess: () => toast.success("Media dihapus"),
          onError: () => toast.error("Gagal menghapus media"),
        });
      }
    },
    [deletePhoto],
  );

  return (
    <div className="space-y-8">
      {storage && (
        <StorageUsageBar
          used={storage.storageUsed}
          limit={storage.storageLimit}
          resourcesCount={storage.resourcesCount}
        />
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Upload Foto & Video</h2>
          <Button size="sm" onClick={() => {
            const closing = showUploader;
            setShowUploader(!showUploader);
            if (closing) {
              setSelectedFiles([]);
              setFileErrors([]);
            }
          }} className="gap-2">
            <ImagePlus className="h-4 w-4" />
            {showUploader ? "Tutup" : "Upload"}
          </Button>
        </div>
        {showUploader && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            {albums && albums.length > 0 && (
              <div className="mb-4">
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Tanpa album</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFilesSelected}
              disabled={uploadPhotos.isPending}
              className="hidden"
              id="gallery-upload-input"
            />

            <label
              htmlFor="gallery-upload-input"
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
                uploadPhotos.isPending
                  ? "pointer-events-none opacity-50"
                  : "hover:border-primary/50",
              )}
            >
              {uploadPhotos.isPending ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {uploadPhotos.isPending
                    ? "Mengupload..."
                    : "Klik untuk pilih media"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WEBP, HEIC, MP4, MOV max {MAX_SIZE_MB}MB (maks {MAX_FILES} file)
                </p>
              </div>
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2 text-left">
                <p className="text-xs font-medium text-muted-foreground">
                  {selectedFiles.length} file dipilih
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {selectedFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {file.type.startsWith("image/") ? (
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <FileVideo className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                      {!uploadPhotos.isPending && (
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="rounded-full p-0.5 transition-colors hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
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

            {selectedFiles.length > 0 && (
              <div className="mt-4 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedFiles([]);
                    setFileErrors([]);
                  }}
                  disabled={uploadPhotos.isPending}
                >
                  Hapus semua
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={uploadPhotos.isPending}
                >
                  {uploadPhotos.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    `Upload ${selectedFiles.length} file`
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Semua Media ({photos.length})
          </h2>
          <div className="flex items-center gap-2">
            {/* Media type tabs */}
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              {MEDIA_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMediaType(key || undefined)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    (mediaType || "") === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Sort toggle */}
            <button
              onClick={() =>
                setSort(sort === "oldest" ? undefined : "oldest")
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                sort === "oldest"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sort === "oldest" ? "Terlama" : "Terbaru"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-3 aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
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
                <div key={photo.id} className="group relative mb-3 break-inside-avoid">
                  <div
                    onClick={() => handlePhotoClick(photos, index)}
                    className="relative overflow-hidden rounded-2xl cursor-pointer"
                  >
                    <Image
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.caption || (photo.isVideo ? "Video" : "Foto")}
                      width={photo.width || 400}
                      height={photo.height || 300}
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="h-auto w-full object-cover"
                    />
                    {photo.isVideo && (
                      <div className="absolute top-3 left-3 rounded-full bg-black/50 p-1.5">
                        <Play className="h-3.5 w-3.5 fill-white text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-end justify-center bg-black/0 p-3 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.id);
                        }}
                        className="rounded-full bg-destructive p-2 text-white transition-transform hover:scale-110"
                        aria-label="Hapus media"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2"
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
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
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
        showAlbumMove={true}
      />
    </div>
  );
}
