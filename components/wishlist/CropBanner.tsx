"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cropCoverStyle, parseCropRect } from "@/lib/image-crop";

// banner renders through imageCrop with the same math as the
// cropper — null crop falls back to plain object-cover. Frame is 16/9, the same
// as the cropper and the form preview, so what was framed is what shows.
function CropBanner({ src, crop, alt, onError, sizes = "(max-width: 768px) 100vw, 33vw" }: { src: string; crop: unknown; alt: string; onError?: () => void; sizes?: string }) {
  const rect = parseCropRect(crop);
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
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
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
    <div ref={ref} className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-xl">
      {style ? (
        <Image
          src={src}
          alt={alt}
          width={Math.round(style.width)}
          height={Math.round(style.height)}
          onLoad={onLoad}
          onError={onError}
          className="absolute max-w-none"
          style={{ left: style.left, top: style.top }}
          sizes={sizes}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          onLoad={onLoad}
          onError={onError}
          sizes={sizes}
          className="object-cover"
        />
      )}
    </div>
  );
}

export default CropBanner;
