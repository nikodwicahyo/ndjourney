"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Photo, AlbumWithCount } from "@/types";
import { useUploadPhotos as useNewUploadPhotos } from "./useUpload";

export const photoKeys = queryKeys.photos;
export const albumKeys = queryKeys.albums;

export function usePhotos(filters?: {
  albumId?: string;
  year?: number;
  isFavorite?: boolean;
  isPublic?: boolean;
  visibility?: "public" | "private";
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
      if (filters?.visibility) params.set("visibility", filters.visibility);
      if (filters?.mediaType) params.set("mediaType", filters.mediaType);
      if (filters?.sort) params.set("sort", filters.sort);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", String(filters?.limit ?? 50));

      const res = await fetch(`/api/photos?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat media");
      return json as { data: Photo[]; nextCursor: string | null; hasMore: boolean; total: number; fotoTotal: number; videoTotal: number };
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
      isPublic?: boolean;
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
      qc.invalidateQueries({ queryKey: photoKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: albumKeys.all, refetchType: 'all' });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "Gagal menghapus media";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore JSON parse errors, keep default message
        }
        if (res.status === 403) {
          message = "Kamu tidak punya akses untuk menghapus media ini";
        } else if (res.status === 404) {
          message = "Media tidak ditemukan atau sudah dihapus";
        } else if (res.status === 429) {
          message = "Terlalu banyak permintaan, coba lagi nanti";
        }
        throw new Error(message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: albumKeys.all, refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ["storage", "usage"], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ["dashboard", "activity"], refetchType: 'all' });
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, albumId, isPublic }: { file: File; albumId?: string; isPublic?: boolean }) => {
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
          isVideo: result.format?.includes("mp4") || result.format?.includes("mov") || result.isVideo || false,
          albumId,
          isPublic,
        }),
      });

      if (!photoRes.ok) {
        const err = await photoRes.json();
        throw new Error(err.error || "Gagal menyimpan foto");
      }

      return photoRes.json();
    },
    onSuccess: () => {
      // refetchType: "all" forces a fresh fetch even within stale time
      qc.invalidateQueries({ queryKey: photoKeys.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["storage", "usage"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboard", "activity"], refetchType: "all" });
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
  format?: string;
  bytes?: number;
};

type UploadResult = {
  uploaded: Photo[];
  failed: { name: string; error: string }[];
};

export function useUploadPhotos() {
  return useNewUploadPhotos();
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
      qc.invalidateQueries({ queryKey: albumKeys.all, refetchType: 'all' });
    },
  });
}
