// Generic non-destructive image crop: a normalized rect over the ORIGINAL file.
// The original is never copied, re-encoded, or replaced — consumers render the
// source through the rect. Reusable for hero, timeline, wishes (each usage owns
// its own rect; the same photo can be cropped differently per usage).

export type CropRect = {
  /** Left edge as fraction of image width, 0..1 */
  x: number;
  /** Top edge as fraction of image height, 0..1 */
  y: number;
  /** Width as fraction of image width, 0..1 (exclusive of x) */
  w: number;
  /** Height as fraction of image height, 0..1 (exclusive of y) */
  h: number;
};

/** Full-frame rect = legacy behavior (plain object-cover). */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** True when the rect covers the whole frame — no bake needed, keep the original file. */
export function isFullCrop(rect: CropRect): boolean {
  return rect.x <= 0 && rect.y <= 0 && rect.w >= 1 && rect.h >= 1;
}

function isFrac(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Parse an unknown (e.g. Prisma Json) value into a CropRect, or null. Never throws. */
export function parseCropRect(value: unknown): CropRect | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (!isFrac(r.x) || !isFrac(r.y) || !isFrac(r.w) || !isFrac(r.h)) return null;
  if (r.w <= 0 || r.h <= 0 || r.x + r.w > 1 || r.y + r.h > 1) return null;
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

/**
 * Source URL for rendering through a rect. Cloudinary thumbs are square
 * center-fills of the original, so an original-space rect only maps onto the
 * ORIGINAL url — applying it to the thumb shows a shifted, magnified region.
 * No crop → thumb (cheap); any crop → original (exact WYSIWYG).
 */
export function cropDisplaySrc(
  original: string,
  thumb: string | null | undefined,
  rect: CropRect | null,
): string {
  return rect ? original : thumb || original;
}

/**
 * Zoom + center whose visible window reproduces `rect` in the frame — exactly
 * the pixels cropCoverStyle renders for it (cover-fit: the largest frame-aspect
 * region inside the rect, centered). Rects saved at another aspect (legacy 3:1
 * wishes) therefore round-trip onto what the card actually shows.
 * null when inputs are unusable.
 */
export type CropView = { zoom: number; cx: number; cy: number };

export function cropViewForRect(
  rect: CropRect,
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): CropView | null {
  if (
    !Number.isFinite(naturalWidth) || naturalWidth <= 0 ||
    !Number.isFinite(naturalHeight) || naturalHeight <= 0 ||
    !Number.isFinite(frameWidth) || frameWidth <= 0 ||
    !Number.isFinite(frameHeight) || frameHeight <= 0
  ) {
    return null;
  }
  const r = clampCropRect(rect);
  const cover = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  // cover-fit of the rect: window = frame aspect, maximal inside r, centered.
  const zoom = Math.max(
    frameWidth / (r.w * naturalWidth * cover),
    frameHeight / (r.h * naturalHeight * cover),
  );
  return { zoom, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/** Clamp a rect into valid bounds (useful after drag/zoom math). */
export function clampCropRect(r: CropRect): CropRect {
  const w = Math.min(Math.max(r.w, 0.01), 1);
  const h = Math.min(Math.max(r.h, 0.01), 1);
  const x = Math.min(Math.max(r.x, 0), 1 - w);
  const y = Math.min(Math.max(r.y, 0), 1 - h);
  return { x, y, w, h };
}

export type CropRender = {
  /** Rendered image size in px */
  width: number;
  height: number;
  /** Offset of the image top-left relative to the frame top-left, in px */
  left: number;
  top: number;
};

/**
 * "Crop, then cover-center into the frame" — the single function behind both the
 * cropper preview and the real render, so WYSIWYG holds by construction.
 * Returns null when inputs are unusable (caller falls back to object-cover).
 */
export function cropCoverStyle(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
  rect: CropRect,
): CropRender | null {
  if (
    !Number.isFinite(naturalWidth) || naturalWidth <= 0 ||
    !Number.isFinite(naturalHeight) || naturalHeight <= 0 ||
    !Number.isFinite(frameWidth) || frameWidth <= 0 ||
    !Number.isFinite(frameHeight) || frameHeight <= 0
  ) {
    return null;
  }
  const r = clampCropRect(rect);
  const cropW = r.w * naturalWidth;
  const cropH = r.h * naturalHeight;
  if (cropW <= 0 || cropH <= 0) return null;
  // Cover the frame with the cropped region, centered (same rule as object-cover).
  const scale = Math.max(frameWidth / cropW, frameHeight / cropH);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const left = (frameWidth - cropW * scale) / 2 - r.x * width;
  const top = (frameHeight - cropH * scale) / 2 - r.y * height;
  return { width, height, left, top };
}

/**
 * Bake a normalized rect into a new image File (client-side only).
 * Used where the consumer stores a plain URL with no rect column (e.g. user
 * avatar rendered by many places through `object-cover`): the crop is applied
 * once, so every existing renderer shows the framed result with zero API or
 * schema changes. Full rect returns the original file untouched (no re-encode).
 * Output is capped at `maxSize` on the long edge — avatars never need 4000px.
 */
export async function cropImageFile(
  file: File,
  rect: CropRect,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<File> {
  const r = clampCropRect(rect);
  if (isFullCrop(r)) return file;
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Crop hanya tersedia di browser");
  }

  const { maxSize = 1024, quality = 0.92 } = opts;
  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;
  try {
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        bitmap = null; // corrupt/unsupported → fall through to <img> path
      }
    }
    let naturalW: number;
    let naturalH: number;
    let source: CanvasImageSource;
    if (bitmap) {
      naturalW = bitmap.width;
      naturalH = bitmap.height;
      source = bitmap;
    } else {
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = document.createElement("img");
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
        el.src = objectUrl!;
      });
      if (!img.naturalWidth || !img.naturalHeight) {
        throw new Error("Gambar tidak dapat dibaca");
      }
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;
      source = img;
    }

    const sx = Math.round(r.x * naturalW);
    const sy = Math.round(r.y * naturalH);
    const sw = Math.max(1, Math.round(r.w * naturalW));
    const sh = Math.max(1, Math.round(r.h * naturalH));
    // Clamp the box inside the bitmap (rounding can overshoot by 1px).
    const cx = Math.min(sx, naturalW - 1);
    const cy = Math.min(sy, naturalH - 1);
    const cw = Math.min(sw, naturalW - cx);
    const ch = Math.min(sh, naturalH - cy);

    const scale = Math.min(1, maxSize / Math.max(cw, ch));
    const dw = Math.max(1, Math.round(cw * scale));
    const dh = Math.max(1, Math.round(ch * scale));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung crop gambar");
    ctx.drawImage(source, cx, cy, cw, ch, 0, 0, dw, dh);

    // Keep PNG as PNG (transparency); everything else → JPEG for avatars.
    const srcType = file.type.toLowerCase();
    const outType = srcType === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, quality),
    );
    if (!blob) throw new Error("Gagal memotong gambar");
    const ext = outType === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "avatar";
    return new File([blob], `${base}-cropped.${ext}`, { type: outType });
  } finally {
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// self-check — full rect == object-cover math; sub-rect stays inside frame.
function selfCheck() {
  const full = cropCoverStyle(1600, 900, 1440, 810, FULL_CROP);
  console.assert(full !== null, "full rect must render");
  const sub = cropCoverStyle(1000, 1000, 1600, 900, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  console.assert(sub !== null && sub.width === 3200 && sub.height === 3200, "center-half must 2x cover");
  console.assert(parseCropRect({ x: 0, y: 0, w: 1.5, h: 1 }) === null, "overflow rect rejected");
  console.assert(parseCropRect(null) === null, "null rejected");
  console.assert(parseCropRect(FULL_CROP) !== null, "full accepted");
}
if (typeof process !== "undefined" && process.env.VITEST_WORKER_ID === undefined && process.env.NODE_ENV !== "production") {
  // runs once on import in dev — zero test-framework dependency.
  try { selfCheck(); } catch { /* ignore */ }
}
