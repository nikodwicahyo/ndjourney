"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { queryKeys } from "@/lib/query-keys";
import type { Photo, CloudinaryUsage } from "@/types";
import { getUploadQueue, type QueuedUpload } from "@/lib/upload-queue";
import { getResourceType, generatePublicId } from "@/lib/upload-config";
import { parseResponseBody } from "@/lib/utils";

type UploadResult = {
  uploaded: Photo[];
  failed: { id: string; name: string; error: string }[];
};

interface UseUploadPhotosReturn {
  uploadFiles: (files: File[], albumId?: string, fileIds?: string[], isPublic?: boolean) => Promise<UploadResult>;
  queue: QueuedUpload[];
  isUploading: boolean;
  cancelUpload: (id: string) => void;
  cancelAllUploads: () => void;
  clearCompleted: () => void;
  clearAllItems: () => void;
  removeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  overallProgress: {
    total: number;
    completed: number;
    failed: number;
    percent: number;
    totalSpeed: number;
    avgEta: number;
  };
}

/** Saves a completed upload to the database; resilient and independent of UI. */
async function savePhotoToDb(
  u: QueuedUpload,
  albumId: string | undefined,
  qc: ReturnType<typeof useQueryClient>,
  isPublic?: boolean
): Promise<Photo> {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: u.result!.url,
      publicId: u.result!.publicId,
      thumbnailUrl: u.result!.thumbnailUrl,
      width: u.result!.width,
      height: u.result!.height,
      fileSize: u.result!.bytes,
      isVideo:
        u.result!.format?.includes("mp4") ||
        u.result!.format?.includes("mov") ||
        u.result!.isVideo ||
        false,
      albumId,
      isPublic,
    }),
  });

  if (!res.ok) {
    const err = await parseResponseBody(res);
    throw new Error(err || "Gagal menyimpan foto");
  }

  const data = await res.json();
  const savedPhoto = data.data as Photo;

  qc.setQueryData<CloudinaryUsage>(["storage", "usage"], (old) => {
    if (!old) return old;
    return {
      ...old,
      storageUsed: old.storageUsed + (u.result?.bytes ?? 0),
      resourcesCount: old.resourcesCount + 1,
    };
  });

  return savedPhoto;
}

function invalidateAfterSave(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.photos.all, refetchType: "all" });
  qc.invalidateQueries({ queryKey: queryKeys.albums.all, refetchType: "all" });
  qc.invalidateQueries({ queryKey: ["storage", "usage"], refetchType: "all" });
  qc.invalidateQueries({ queryKey: ["dashboard", "stats"], refetchType: "all" });
  qc.invalidateQueries({ queryKey: ["dashboard", "activity"], refetchType: "all" });
}

export function useUploadPhotos(): UseUploadPhotosReturn {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const queueRef = useRef<ReturnType<typeof getUploadQueue> | null>(null);
  const albumIdRef = useRef<string | undefined>(undefined);

  if (!queueRef.current) {
    queueRef.current = getUploadQueue();
  }

  // Keep React state in sync with the persistent singleton queue.
  useEffect(() => {
    const q = queueRef.current!;
    const sync = () => setQueue(q.getAll());
    // Auto-clear successfully completed items once the whole batch finishes,
    // regardless of whether the component is still mounted (uploads continue
    // in the background while navigating away / minimizing the tab).
    // Failed/interrupted items are kept so the user can retry them.
    const onAllComplete = () => {
      q.clearCompleted();
      setQueue(q.getAll());
    };
    q.setListeners({ onProgress: sync, onComplete: sync, onError: sync, onAllComplete });
    sync();
    return () => {
      // Intentionally do NOT destroy the singleton on unmount — it must outlive
      // navigation so background uploads keep running.
    };
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], albumId?: string, fileIds?: string[], isPublic?: boolean): Promise<UploadResult> => {
      const uploadQueue = queueRef.current!;
      albumIdRef.current = albumId;

      const userId = session?.user?.id || "temp";
      const publicIds = files.map((file) => generatePublicId(file.name, userId));
      const resourceTypes = files.map((file) => getResourceType(file.type));

      // addMultiple returns a Promise<QueuedUpload>[] — each resolves/rejects when that file finishes.
      const uploadPromises = files.map((file, idx) =>
        uploadQueue.add(file, publicIds[idx], resourceTypes[idx], fileIds?.[idx], albumId)
      );
      setQueue(uploadQueue.getAll());

      const savePromises = uploadPromises.map(async (promise, idx) => {
        const file = files[idx];
        let itemId: string | undefined;
        try {
          const u = await promise;
          itemId = u.id;
          if (u.status === "complete" && u.result) {
            const savedPhoto = await savePhotoToDb(u, albumId, qc, isPublic);
            return { status: "fulfilled" as const, value: savedPhoto };
          } else if (u.status === "interrupted" || u.status === "error") {
            throw new Error(u.error || "Upload gagal");
          } else {
            // cancelled / not completed
            throw new Error(u.error || "Upload dibatalkan");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Upload gagal";
          return { status: "rejected" as const, reason: { id: itemId, name: file.name, error: errorMessage } };
        }
      });

      const results = await Promise.all(savePromises);

      invalidateAfterSave(qc);

      const uploaded = results
        .filter((r): r is { status: "fulfilled"; value: Photo } => r.status === "fulfilled")
        .map((r) => r.value);

      const failed = results
        .filter((r): r is { status: "rejected"; reason: { id: string; name: string; error: string } } => r.status === "rejected")
        .map((r) => r.reason)
        .filter((r): r is { id: string; name: string; error: string } => !!r);

      setQueue(uploadQueue.getAll());

      return { uploaded, failed };
    },
    [qc, session]
  );

  const cancelUpload = useCallback((id: string) => {
    const q = queueRef.current;
    if (q) {
      q.cancel(id);
      setQueue(q.getAll());
    }
  }, []);

  const cancelAllUploads = useCallback(() => {
    const q = queueRef.current;
    if (q) {
      q.cancelAll();
      setQueue(q.getAll());
    }
  }, []);

  const clearCompleted = useCallback(() => {
    const q = queueRef.current;
    if (q) {
      q.clearCompleted();
      setQueue(q.getAll());
    }
  }, []);

  const clearAllItems = useCallback(() => {
    const q = queueRef.current;
    if (q) {
      q.clearAllItems();
      setQueue(q.getAll());
    }
  }, []);

  const removeUpload = useCallback((id: string) => {
    const q = queueRef.current;
    if (q) {
      q.remove(id);
      setQueue(q.getAll());
    }
  }, []);

  const retryUpload = useCallback((id: string) => {
    const q = queueRef.current;
    if (!q) return;
    const task = q.getById(id);
    if (!task || task.status !== "error") return;
    q.resetToPending(id);
    setQueue(q.getAll());
  }, []);

  const uploading = queue.filter((u) => u.status === "uploading");
  const overallProgress = {
    total: queue.length,
    completed: queue.filter((u) => u.status === "complete").length,
    failed: queue.filter((u) => u.status === "error" || u.status === "interrupted").length,
    percent:
      queue.length > 0
        ? Math.round(
            (queue.filter((u) => u.status === "complete").length / queue.length) * 100
          )
        : 0,
    totalSpeed: queue.reduce((sum, u) => sum + (u.progress.speed || 0), 0),
    avgEta:
      uploading.length > 0
        ? Math.round(uploading.reduce((sum, u) => sum + u.progress.eta, 0) / uploading.length)
        : 0,
  };

  return {
    uploadFiles,
    queue,
    isUploading: queue.some((u) => u.status === "uploading" || u.status === "pending" || u.status === "retrying"),
    cancelUpload,
    cancelAllUploads,
    clearCompleted,
    clearAllItems,
    removeUpload,
    retryUpload,
    overallProgress,
  };
}

export function useUploadPhoto() {
  const qc = useQueryClient();

  return {
    mutateAsync: async ({ file, albumId }: { file: File; albumId?: string }) => {
      const { uploadFileSimple } = await import("@/lib/chunked-upload");

      const result = await uploadFileSimple(file, () => {}, undefined);

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          publicId: result.publicId,
          thumbnailUrl: result.thumbnailUrl,
          width: result.width,
          height: result.height,
          fileSize: result.bytes,
          isVideo:
            result.format?.includes("mp4") ||
            result.format?.includes("mov") ||
            result.isVideo ||
            false,
          albumId,
        }),
      });

      if (!photoRes.ok) {
        const err = await parseResponseBody(photoRes);
        throw new Error(err);
      }

      const data = await photoRes.json();

      invalidateAfterSave(qc);

      return data;
    },
  };
}
