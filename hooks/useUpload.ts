"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Photo } from "@/types";
import { createUploadQueue, QueuedUpload } from "@/lib/upload-queue";
import { getResourceType, generatePublicId } from "@/lib/upload-config";
import { parseResponseBody } from "@/lib/utils";

const photoKeys = queryKeys.photos;

type UploadResult = {
  uploaded: Photo[];
  failed: { name: string; error: string }[];
};

interface UseUploadPhotosReturn {
  uploadFiles: (files: File[], albumId?: string) => Promise<UploadResult>;
  queue: QueuedUpload[];
  isUploading: boolean;
  cancelUpload: (id: string) => void;
  cancelAllUploads: () => void;
  clearCompleted: () => void;
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

export function useUploadPhotos(): UseUploadPhotosReturn {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const queueRef = useRef<ReturnType<typeof createUploadQueue> | null>(null);

  const getOrCreateQueue = useCallback(() => {
    if (!queueRef.current) {
      queueRef.current = createUploadQueue({
        maxConcurrency: 4,
        chunkSize: 8 * 1024 * 1024,
        folder: "ndjourney-web",
        onProgress: () => {
          if (queueRef.current) setQueue(queueRef.current.getAll());
        },
        onComplete: () => {
          if (queueRef.current) setQueue(queueRef.current.getAll());
        },
        onError: () => {
          if (queueRef.current) setQueue(queueRef.current.getAll());
        },
        onAllComplete: () => {
          if (queueRef.current) setQueue(queueRef.current.getAll());
        },
      });
    }
    return queueRef.current;
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], albumId?: string): Promise<UploadResult> => {
      const uploadQueue = getOrCreateQueue();

      // Clear any stale items from previous upload sessions
      uploadQueue.clearAll();
      setQueue([]);

      const publicIds = files.map((file) => generatePublicId(file.name, "temp"));
      const resourceTypes = files.map((file) => getResourceType(file.type));

      // addMultiple returns a Promise<QueuedUpload>[] — each resolves/rejects when that specific file finishes
      const uploadPromises = uploadQueue.addMultiple(files, publicIds, resourceTypes);
      setQueue(uploadQueue.getAll());

      const savePromises = uploadPromises.map(async (promise, idx) => {
        const file = files[idx];
        try {
          const u = await promise;
          if (u.status === "complete" && u.result) {
            // Save to database immediately
            const photoRes = await fetch("/api/photos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: u.result.url,
                publicId: u.result.publicId,
                thumbnailUrl: u.result.thumbnailUrl,
                width: u.result.width,
                height: u.result.height,
                fileSize: u.result.bytes,
                isVideo:
                  u.result.format?.includes("mp4") ||
                  u.result.format?.includes("mov") ||
                  u.result.isVideo ||
                  false,
                albumId,
              }),
            });

            if (!photoRes.ok) {
              const err = await parseResponseBody(photoRes);
              throw new Error(err || "Failed to save photo");
            }

            const resData = await photoRes.json();
            const savedPhoto = resData.data as Photo;

            // Invalidate queries so it shows up in gallery immediately!
            qc.invalidateQueries({ queryKey: photoKeys.all, refetchType: "all" });
            qc.invalidateQueries({ queryKey: queryKeys.albums.all, refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["storage", "usage"], refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["dashboard", "stats"], refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["dashboard", "activity"], refetchType: "all" });

            return { status: "fulfilled", value: savedPhoto };
          } else {
            throw new Error(u.error || "Upload failed");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Upload failed";
          return { status: "rejected", reason: { name: file.name, error: errorMessage } };
        }
      });

      const results = await Promise.all(savePromises);

      const uploaded = results
        .filter((r): r is { status: "fulfilled"; value: Photo } => r.status === "fulfilled")
        .map((r) => r.value);

      const failed = results
        .filter((r): r is { status: "rejected"; reason: { name: string; error: string } } => r.status === "rejected")
        .map((r) => r.reason);

      // Sync UI state immediately
      setQueue(uploadQueue.getAll());

      return { uploaded, failed };
    },
    [getOrCreateQueue, qc]
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

  const removeUpload = useCallback((id: string) => {
    const q = queueRef.current;
    if (q) {
      q.remove(id);
      setQueue(q.getAll());
    }
  }, []);

  const retryUpload = useCallback(async (id: string) => {
    const q = queueRef.current;
    const upload = q?.getById(id);
    if (!upload || upload.status !== "error") return;
    q?.remove(id);
    q?.add(upload.file, upload.publicId, upload.resourceType);
    if (q) setQueue(q.getAll());
  }, []);

  const uploading = queue.filter((u) => u.status === "uploading");
  const overallProgress = {
    total: queue.length,
    completed: queue.filter((u) => u.status === "complete").length,
    failed: queue.filter((u) => u.status === "error").length,
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
    isUploading: queue.some((u) => u.status === "uploading" || u.status === "pending"),
    cancelUpload,
    cancelAllUploads,
    clearCompleted,
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

      // Force gallery to refetch immediately (bypass stale time)
      qc.invalidateQueries({ queryKey: photoKeys.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: queryKeys.albums.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["storage", "usage"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboard", "activity"], refetchType: "all" });

      return data;
    },
  };
}
