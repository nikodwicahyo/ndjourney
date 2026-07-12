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
  isVideo?: boolean;
};

type UploadResult = {
  uploaded: Photo[];
  failed: { name: string; error: string }[];
};

async function uploadSingleFile(file: File): Promise<UploadFileResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Upload failed");
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
      const uploadedFiles: UploadFileResult[] = [];
      const failed: { name: string; error: string }[] = [];

      for (const file of files) {
        try {
          const result = await uploadSingleFile(file);
          uploadedFiles.push(result);
        } catch (err) {
          failed.push({
            name: file.name,
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      if (uploadedFiles.length === 0) {
        return { uploaded: [], failed };
      }

      const photoRes = await fetch("/api/photos/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: uploadedFiles.map((f) => ({
            url: f.url,
            publicId: f.publicId,
            thumbnailUrl: f.thumbnailUrl,
            width: f.width,
            height: f.height,
            isVideo: f.isVideo ?? false,
            albumId,
          })),
        }),
      });

      if (!photoRes.ok) {
        const err = await photoRes.json();
        throw new Error(err.error || "Bulk upload failed");
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
