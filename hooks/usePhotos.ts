"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Photo, AlbumWithCount } from "@/types";

export const photoKeys = queryKeys.photos;
export const albumKeys = queryKeys.albums;

export function usePhotos(filters?: {
  albumId?: string;
  year?: number;
  isFavorite?: boolean;
  isPublic?: boolean;
  limit?: number;
  mediaType?: string;
  sort?: string;
}) {
  return useInfiniteQuery({
    queryKey: photoKeys.list(filters),
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams();
      if (filters?.albumId) params.set("albumId", filters.albumId);
      if (filters?.year) params.set("year", String(filters.year));
      if (filters?.isFavorite) params.set("isFavorite", "true");
      if (filters?.isPublic) params.set("public", "true");
      if (filters?.mediaType) params.set("mediaType", filters.mediaType);
      if (filters?.sort) params.set("sort", filters.sort);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", String(filters?.limit ?? 50));

      const res = await fetch(`/api/photos?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat media");
      return json as { data: Photo[]; nextCursor: string | null; hasMore: boolean };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 30_000,
  });
}

export function usePhoto(id: string) {
  return useQuery({
    queryKey: photoKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/photos/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat media");
      return json.data as Photo;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useUpdatePhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      caption?: string;
      albumId?: string | null;
      isFavorite?: boolean;
    }) => {
      const res = await fetch(`/api/photos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengupdate media");
      return json.data;
    },
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: photoKeys.all });
      const previousQueries = qc.getQueriesData({ queryKey: photoKeys.all });
      qc.setQueriesData({ queryKey: photoKeys.all }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        if ("pages" in old) {
          return {
            ...old,
            pages: (old as { pages: Array<{ data: Photo[] }> }).pages.map((p) => ({
              ...p,
              data: p.data.map((ph: Photo) =>
                ph.id === id ? { ...ph, ...data } : ph
              ),
            })),
          };
        }
        if ("data" in old) {
          return { ...old, data: { ...(old as { data: Photo }).data, ...data } };
        }
        return old;
      });
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus media");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all });
      qc.invalidateQueries({ queryKey: ["storage", "usage"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, albumId }: { file: File; albumId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const uploadData: { data: UploadFileResult } = await uploadRes.json();

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploadData.data.url,
          publicId: uploadData.data.publicId,
          thumbnailUrl: uploadData.data.thumbnailUrl,
          width: uploadData.data.width,
          height: uploadData.data.height,
          isVideo: uploadData.data.isVideo ?? false,
          albumId,
        }),
      });

      if (!photoRes.ok) {
        const err = await photoRes.json();
        throw new Error(err.error || "Failed to save photo");
      }

      return photoRes.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all });
      qc.invalidateQueries({ queryKey: ["storage", "usage"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

type UploadFileResult = {
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  isVideo?: boolean;
};

type UploadResult = {
  uploaded: Photo[];
  failed: { name: string; error: string }[];
};

async function parseResponseBody(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = await res.json();
      return json.error || json.message || res.statusText;
    } catch {
      return res.statusText || "Upload failed";
    }
  }
  const text = await res.text();
  const cleaned = text.replace(/<[^>]*>/g, "").trim().substring(0, 200);
  return cleaned || res.statusText || "Upload failed";
}

const UPLOAD_CONCURRENCY = 3;

async function uploadSingleFile(
  file: File,
  signal?: AbortSignal,
): Promise<UploadFileResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const errorMessage = await parseResponseBody(res);
    throw new Error(errorMessage);
  }

  const data: { data: UploadFileResult } = await res.json();
  return data.data;
}

export function useUploadPhotos() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      files,
      albumId,
    }: {
      files: File[];
      albumId?: string;
    }): Promise<UploadResult> => {
      const ac = new AbortController();
      const batches: File[][] = [];
      for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
        batches.push(files.slice(i, i + UPLOAD_CONCURRENCY));
      }

      const allResults: { name: string; result?: UploadFileResult; error?: string }[] = [];

      for (const batch of batches) {
        const settled = await Promise.allSettled(
          batch.map((file) =>
            uploadSingleFile(file, ac.signal).then(
              (result) => ({ name: file.name, result }),
              (err: unknown) => ({
                name: file.name,
                error: err instanceof Error ? err.message : "Upload failed",
              }),
            ),
          ),
        );

        for (const s of settled) {
          if (s.status === "fulfilled") {
            allResults.push(s.value);
          } else {
            allResults.push({
              name: "unknown",
              error: s.reason instanceof Error ? s.reason.message : "Upload failed",
            });
          }
        }
      }

      const uploadedFiles = allResults.filter(
        (r): r is { name: string; result: UploadFileResult } => !!r.result,
      );
      const failed = allResults
        .filter((r): r is { name: string; error: string } => !!r.error)
        .map((r) => ({ name: r.name, error: r.error }));

      if (uploadedFiles.length === 0) {
        return { uploaded: [], failed };
      }

      const photoRes = await fetch("/api/photos/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: uploadedFiles.map((f) => ({
            url: f.result.url,
            publicId: f.result.publicId,
            thumbnailUrl: f.result.thumbnailUrl,
            width: f.result.width,
            height: f.result.height,
            fileSize: f.result.fileSize,
            isVideo: f.result.isVideo ?? false,
            albumId,
          })),
        }),
      });

      if (!photoRes.ok) {
        const errorMessage = await parseResponseBody(photoRes);
        throw new Error(errorMessage);
      }

      const photoData: { data: Photo[] } = await photoRes.json();
      return { uploaded: photoData.data, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all });
      qc.invalidateQueries({ queryKey: ["storage", "usage"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useAlbums() {
  return useQuery({
    queryKey: albumKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/albums");
      const json = await res.json();
      return json.data as AlbumWithCount[];
    },
    staleTime: 60_000,
  });
}

export function useCreateAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat album");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: albumKeys.all });
    },
  });
}
