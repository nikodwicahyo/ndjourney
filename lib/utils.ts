import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInJakarta } from "./date";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The gallery grid: 2 columns on phones, 3 from md, 4 from lg.
 *
 * Shipped as a constant because the order bug it fixes came from the layers
 * disagreeing — the real grid, the infinite-scroll tail and the skeletons each
 * spelled out their own columns, so they drifted (the dashboard fallback was
 * rendering a single column on mobile). CSS grid lays items out left→right,
 * row by row, so DOM order IS the reading order.
 */
export const GALLERY_GRID_CLASSES = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4";

/**
 * The uniform gallery tile. Every card carries the same square box and the image
 * covers it, so rows are equal height and the order is deterministic on every
 * device. The alternative — sizing each tile from its own photo ratio — forces
 * either a masonry (order drifts) or per-photo cropping logic.
 */
export const GALLERY_TILE_CLASSES = "aspect-square w-full";

/**
 * One control size for every dashboard toolbar. Filter chips and compact
 * buttons (Button size="sm") share the same 40px pill, so a filter can never
 * sit a few pixels shorter than the action button beside it.
 */
export const FILTER_CHIP_CLASSES =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors";

/** Segmented filter group: 40px outer box, segments stretch to fill it. */
export const FILTER_GROUP_CLASSES =
  "inline-flex h-10 items-center rounded-full border border-border p-0.5";

export const FILTER_SEGMENT_CLASSES =
  "inline-flex h-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors";

/**
 * Photos per page. One value for the whole stack: the /api/photos default and
 * every gallery surface, so the client and the server never disagree about how
 * far a cursor has to jump.
 */
export const PHOTO_PAGE_SIZE = 40;

export function formatDate(date: Date | string): string {
  return formatInJakarta(date, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${timePart}, ${datePart}`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan lalu`;

  return `${Math.floor(diffDays / 365)} tahun lalu`;
}

export function getDaysSince(date: Date | string): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  if (isNaN(d.getTime())) return 0;
  const diffMs = Date.now() - d.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function pickFromSeed<T>(arr: T[], seed: number): T {
  const rng = seededRandom(seed);
  return arr[Math.floor(rng() * arr.length)];
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "j";
  if (n >= 1000) return (n / 1000).toFixed(1) + "rb";
  return n.toLocaleString("id-ID");
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const base = 1024;
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, unitIndex);
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function encodeCompositeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString("base64url");
}

export function decodeCompositeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.c === "string" && typeof parsed.i === "string") {
      return { createdAt: parsed.c, id: parsed.i };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `c${timestamp}${random}`;
}

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  // extension OR delivery path — Cloudinary video URLs are often
  // extensionless (…/video/upload/v123/…), so the path marker must count.
  return /\.(mp4|webm|mov|avi|mkv|m3u8)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
}

export type UploadSaveResult = {
  url: string;
  publicId: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  fileSize?: number | null;
  format?: string | null;
  isVideo?: boolean | null;
};

// Single photo-save payload builder — the three upload paths hand-rolled this
// with mp4|mov-only checks, misclassifying webm/avi/mkv as photos.
// NOTE: keys with no value must be OMITTED, not null — createPhotoSchema is
// `.optional()` without `.nullable()`, so explicit nulls 400 (verified by
// execution against the real schema). The route coalesces to null itself.
export function buildPhotoPayload(
  result: UploadSaveResult,
  albumId?: string,
  isPublic?: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    url: result.url,
    publicId: result.publicId,
    isVideo: result.isVideo ?? isVideoUrl(result.url),
  };
  if (result.thumbnailUrl != null) payload.thumbnailUrl = result.thumbnailUrl;
  if (result.width != null) payload.width = result.width;
  if (result.height != null) payload.height = result.height;
  const fileSize = result.fileSize ?? result.bytes;
  if (fileSize != null) payload.fileSize = fileSize;
  if (albumId != null) payload.albumId = albumId;
  if (isPublic !== undefined) payload.isPublic = isPublic;
  return payload;
}

// Still image a browser <img> can actually render (excludes HEIC/HEIF:
// iPhone uploads browsers cannot decode → would show as broken card).
export function isRenderableImageUrl(url?: string | null): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (isVideoUrl(url)) return false;
  return !/\.(heic|heif)(\?|$)/i.test(url);
}

// Single public-media gate for games: private rows must never render even
// if the caller passes an unfiltered list (stale cache → isPublic missing
// counts as public, explicit false is always excluded).
export function selectPublicPhotos<T extends Record<string, unknown>>(
  photos: T[],
): T[] {
  return photos.filter(
    (p) => (p as { isPublic?: unknown }).isPublic !== false,
  );
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function parseResponseBody(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = await res.json();
      return json.error || json.message || res.statusText;
    } catch {
      return res.statusText || "Gagal upload";
    }
  }
  const text = await res.text();
  const cleaned = text.replace(/<[^>]*>/g, "").trim().substring(0, 200);
  return cleaned || res.statusText || "Gagal upload";
}
