"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { cropCoverStyle, cropViewForRect, clampCropRect, type CropRect } from "@/lib/image-crop";

export type { CropRect };

type PhotoCropperProps = {
  open: boolean;
  /** Object URL (fresh upload) or remote URL (gallery pick). Never modified. */
  src: string;
  /** Frame aspect w/h. Default 16/9 (desktop hero). */
  aspect?: number;
  initialRect?: CropRect | null;
  /** "phone" overlays the 9:16 safe-area guide. Default "none". */
  guide?: "phone" | "none";
  title?: string;
  onCancel: () => void;
  /** Rect over the ORIGINAL image — no copy is produced. */
  onDone: (rect: CropRect) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function PhotoCropper({
  open,
  src,
  aspect = 16 / 9,
  initialRect = null,
  guide = "none",
  title = "Atur Crop Foto",
  onCancel,
  onDone,
}: PhotoCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const restoredRef = useRef(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [center, setCenter] = useState({ cx: 0.5, cy: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState(false);

  // Reset per source so reopening with another photo never reuses stale state.
  // The saved view (center AND zoom) is restored once the image + frame measure
  // in — so reopening shows exactly the saved framing, never a reset zoom-1 view.
  useEffect(() => {
    if (open) {
      setNatural(null);
      setFrame(null);
      setLoadError(false);
      restoredRef.current = false;
      setCenter({ cx: 0.5, cy: 0.5 });
      setZoom(1);
    }
  }, [open, src]);

  // Measure the frame (ResizeObserver keeps drag math exact on rotate/resize).
  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, natural]);

  // Cover scale in px: image covers frame at zoom 1 (== today's object-cover).
  const coverScale = natural && frame
    ? Math.max(frame.w / natural.w, frame.h / natural.h)
    : 0;
  const renderW = natural ? natural.w * coverScale * zoom : 0;
  const renderH = natural ? natural.h * coverScale * zoom : 0;

  // Visible window as fractions = the crop rect.
  const rect: CropRect | null = natural && frame && renderW > 0 && renderH > 0
    ? clampCropRect({
      w: frame.w / renderW,
      h: frame.h / renderH,
      x: center.cx - frame.w / renderW / 2,
      y: center.cy - frame.h / renderH / 2,
    })
    : null;

  const clampCenter = useCallback((cx: number, cy: number, z: number): { cx: number; cy: number } => {
    if (!natural || !frame) return { cx, cy };
    const rw = frame.w / (natural.w * coverScale * z);
    const rh = frame.h / (natural.h * coverScale * z);
    const cxr: [number, number] = rw >= 1 ? [0.5, 0.5] : [rw / 2, 1 - rw / 2];
    const cyr: [number, number] = rh >= 1 ? [0.5, 0.5] : [rh / 2, 1 - rh / 2];
    return {
      cx: Math.min(Math.max(cx, cxr[0]), cxr[1]),
      cy: Math.min(Math.max(cy, cyr[0]), cyr[1]),
    };
  }, [natural, frame, coverScale]);

  // Restore the saved view once measurable: zoom + center whose window IS the
  // saved rect rendered (cropViewForRect == cropCoverStyle's visible region), so
  // preview shows exactly what the card shows — even for rects saved at another
  // aspect. Runs once per open — user edits after are theirs.
  useEffect(() => {
    if (!open || restoredRef.current || !initialRect || !natural || !frame) return;
    const view = cropViewForRect(initialRect, natural.w, natural.h, frame.w, frame.h);
    if (!view) return;
    const z = Math.min(view.zoom, MAX_ZOOM);
    setCenter(clampCenter(view.cx, view.cy, z));
    setZoom(z);
    restoredRef.current = true;
  }, [open, initialRect, natural, frame, clampCenter]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, cx: center.cx, cy: center.cy };
  }, [center]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || renderW <= 0 || renderH <= 0) return;
    const dx = (e.clientX - d.x) / renderW;
    const dy = (e.clientY - d.y) / renderH;
    setCenter(clampCenter(d.cx - dx, d.cy - dy, zoom));
  }, [renderW, renderH, zoom, clampCenter]);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  const handleZoom = useCallback((z: number) => {
    const nz = Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);
    setZoom(nz);
    setCenter((c) => clampCenter(c.cx, c.cy, nz));
  }, [clampCenter]);

  // Same math as the real render (lib/image-crop) — preview IS the output.
  const style = natural && frame && rect
    ? cropCoverStyle(natural.w, natural.h, frame.w, frame.h, rect)
    : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between p-4 pb-0">
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <button type="button" onClick={onCancel} aria-label="Tutup" className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-1 transition-colors hover:bg-muted">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="px-4 pt-1 text-xs text-muted-foreground">
          Kotak ini adalah area foto yang akan dicrop. Geser untuk membingkai dan gunakan slider untuk zoom.
        </p>

        <div className="p-4">
          <div
            ref={frameRef}
            onPointerDown={natural && !loadError ? onPointerDown : undefined}
            onPointerMove={natural && !loadError ? onPointerMove : undefined}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-muted"
            style={{ aspectRatio: `${aspect}`, cursor: natural && !loadError ? "grab" : "default" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                } else {
                  setLoadError(true);
                }
              }}
              onError={(e) => {
                // Keep the culprit visible in the console — "try another photo"
                // alone never says WHICH source the browser refused.
                console.error("[PhotoCropper] image failed to load:", src, e.type);
                setLoadError(true);
              }}
              className="absolute max-w-none"
              style={style
                ? { width: style.width, height: style.height, left: style.left, top: style.top }
                : { width: "100%", height: "100%", objectFit: "cover" }}
            />
            {guide === "phone" && natural && !loadError && (
              <div
                className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ aspectRatio: "9 / 16" }}
              >
                <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  Area aman HP
                </span>
              </div>
            )}
            {guide === "phone" && natural && !loadError && (
              <span className="pointer-events-none absolute bottom-2 left-2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                Desktop
              </span>
            )}
            {/* Rule of thirds: 2 vertical + 2 horizontal lines at the 1/3 marks.
                Drawn last so the phone mask can't dim it; layout-only, no state. */}
            {natural && !loadError && (
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/50 shadow-[0_0_1px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/50 shadow-[0_0_1px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-white/50 shadow-[0_0_1px_rgba(0,0,0,0.6)]" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-white/50 shadow-[0_0_1px_rgba(0,0,0,0.6)]" />
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
                Gagal memuat gambar. Coba foto lain.
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => handleZoom(Number(e.target.value))}
              disabled={!natural || loadError}
              className="flex-1"
              aria-label="Zoom"
            />
            <button
              type="button"
              onClick={() => { setCenter({ cx: 0.5, cy: 0.5 }); handleZoom(1); }}
              disabled={!natural || loadError}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-1.5 transition-colors hover:bg-muted disabled:opacity-40"
              aria-label="Reset"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={cn("flex gap-2 p-4 pt-0", "flex-col sm:flex-row")}>
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!rect || loadError}
            onClick={() => rect && onDone({ x: 0, y: 0, w: 1, h: 1 })}
          >
            Pakai Asli
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!rect || loadError}
            onClick={() => rect && onDone(rect)}
          >
            Terapkan Crop
          </Button>
        </div>
      </div>
    </div>
  );
}
