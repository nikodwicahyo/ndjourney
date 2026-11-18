"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type FullscreenImageProps = {
  src: string;
  alt: string;
  /** Optional caption shown above the bottom edge (pointer-events off). */
  caption?: string | null;
  onClose: () => void;
};

// Renders through document.body: DialogContent applies a CSS transform, which
// would trap a `fixed inset-0` overlay inside the modal's rectangle. Backdrop
// tap, the X button, and Escape (routed through the parent dialog's
// onOpenChange guard) all dismiss the overlay.
function FullscreenImage({ src, alt, caption, onClose }: FullscreenImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Reset load state when the source changes while the overlay stays mounted.
  // Render-time adjustment (React-endorsed), not a post-paint effect.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(false);
    setLoaded(false);
  }

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      onKeyDown={(e) => {
        // Single focusable control: keep Tab inside the overlay instead of
        // tabbing into the hidden page behind it.
        if (e.key === "Tab") {
          e.preventDefault();
          closeRef.current?.focus();
        }
      }}
      style={{ zIndex: 2147483647 }}
      className="fixed inset-x-0 top-0 flex h-[100dvh] touch-manipulation select-none items-center justify-center overscroll-contain bg-black/90"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        autoFocus
        aria-label="Tutup foto"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
        className="absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>

      {failed ? (
        <p role="alert" className="px-6 text-center text-sm text-white/70">
          Gagal memuat gambar
        </p>
      ) : (
        <>
          {!loaded && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/60">
              Memuat gambar…
            </p>
          )}
          <div className="relative h-full w-full">
            <Image
              src={src}
              alt={alt}
              fill
              priority
              draggable={false}
              sizes="100vw"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className="object-contain p-2 sm:p-8"
            />
          </div>
        </>
      )}

      {caption && (
        <p
          className="pointer-events-none absolute inset-x-0 px-6 text-center text-sm text-white/80"
          style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {caption}
        </p>
      )}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : null;
}

export default React.memo(FullscreenImage);
