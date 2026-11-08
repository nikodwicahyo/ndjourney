"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cropCoverStyle, cropDisplaySrc, parseCropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

// thumb renders through the link crop with the same math as the
// cropper — null crop falls back to plain object-cover. src = ORIGINAL url
// (rects are original-space), thumb = square center-fill for the no-crop case.
function CropThumb({ src, thumb, crop, eager, alt, sizes = "130px" }: { src: string; thumb?: string | null; crop: unknown; eager?: boolean; alt: string; sizes?: string }) {
  const rect = parseCropRect(crop);
  // Cloudinary variant of the original (aspect-preserving → crop
  // fractions stay exact). Raw originals hang /_next/image past its 7s timeout
  // (500) and HEIC never decodes in the browser — same rule as WishCard.
  const url = getOptimizedImageUrl(cropDisplaySrc(src, thumb, rect), 640);
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset measured dimensions when the image changes — render-time adjustment
  // (React-endorsed), not a post-paint effect, so no cascading render.
  const [prevUrl, setPrevUrl] = useState(url);
  if (prevUrl !== url) {
    setPrevUrl(url);
    setNatural(null);
  }

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  const style = rect && natural && frame
    ? cropCoverStyle(natural.w, natural.h, frame.w, frame.h, rect)
    : null;

  return (
    <div ref={ref} className="absolute inset-0">
      {style ? (
        <Image
          src={url}
          alt={alt}
          width={Math.round(style.width)}
          height={Math.round(style.height)}
          onLoad={onLoad}
          className="absolute max-w-none transition-transform hover:scale-110"
          style={{ left: style.left, top: style.top }}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <Image
          src={url}
          alt={alt}
          fill
          onLoad={onLoad}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition-transform hover:scale-110"
        />
      )}
    </div>
  );
}

export default CropThumb;
