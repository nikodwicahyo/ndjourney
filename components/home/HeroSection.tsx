"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Heart } from "lucide-react";
import { isVideoUrl } from "@/lib/utils";
import { cropCoverStyle, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { DEFAULT_NAME1, DEFAULT_NAME2, resolveTagline } from "@/lib/couple-display";

type HeroSectionProps = {
  name1?: string | null;
  name2?: string | null;
  tagline?: string | null;
  heroPhotoUrl?: string | null;
  heroCrop?: CropRect | null;
};

export default function HeroSection({
  name1,
  name2,
  tagline,
  heroPhotoUrl,
  heroCrop = null,
}: HeroSectionProps) {
  const displayName1 = name1?.trim() || DEFAULT_NAME1;
  const displayName2 = name2?.trim() || DEFAULT_NAME2;
  const displayTagline = resolveTagline(tagline);
  const heroIsVideo = useMemo(() => isVideoUrl(heroPhotoUrl), [heroPhotoUrl]);
  const fullName = `${displayName1} & ${displayName2}`;
  // crop renders with the SAME math as the cropper preview (lib/image-crop),
  // measured against the real viewport — preview IS the output.
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: Math.round(window.innerHeight * 0.9) });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };
  const cropStyle = !heroIsVideo && heroCrop && natural && viewport
    ? cropCoverStyle(natural.w, natural.h, viewport.w, viewport.h, heroCrop)
    : null;
  const scrollToContent = () => {
    // No explicit `behavior`: `html { scroll-behavior: smooth }` owns it and the
    // reduced-motion block flips that to `auto`. One source of truth, no JS
    // branch, no hydration risk.
    document.getElementById("home-content")?.scrollIntoView({ block: "start" });
  };

  const heroAlt = `${displayName1} dan ${displayName2}`;

  return (
    <section
      aria-label={fullName}
      className="relative flex min-h-[90svh] items-center justify-center overflow-hidden"
      style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
    >
      {heroPhotoUrl ? (
        <div className="absolute inset-0">
          {heroIsVideo ? (
            <video
              src={heroPhotoUrl}
              autoPlay
              loop
              muted
              playsInline
              aria-label={heroAlt}
              className="h-full w-full object-cover"
            />
          ) : cropStyle ? (
            <Image
              src={getOptimizedImageUrl(heroPhotoUrl, 1600)}
              alt={heroAlt}
              width={Math.round(cropStyle.width)}
              height={Math.round(cropStyle.height)}
              onLoad={handleImgLoad}
              className="absolute max-w-none"
              style={{ left: cropStyle.left, top: cropStyle.top }}
              priority
              loading="eager"
              fetchPriority="high"
              // The LCP image must decode before paint; async decode pushes it
              // behind hydration work on slow devices.
              decoding="sync"
              sizes="100vw"
            />
          ) : (
            <Image
              src={getOptimizedImageUrl(heroPhotoUrl, 1600)}
              alt={heroAlt}
              fill
              onLoad={handleImgLoad}
              className="object-cover"
              priority
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              sizes="100vw"
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/30" />
      )}

      {/* Readability scrim (photo heroes only): darkens any image so the
          stroke-free text stays legible — bright, dark, or busy photos. */}
      {heroPhotoUrl && (
        <div
          aria-hidden="true"
          data-testid="hero-scrim"
          className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/60"
        />
      )}

      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center [text-shadow:0_1px_3px_rgb(0_0_0/0.7),0_4px_24px_rgb(0_0_0/0.5)]">
        {/* CSS entrance (Tailwind's `slide-up`): server HTML is identical and
            the animation starts before hydration, unlike a framer opacity:0. */}
        <div className="animate-slide-up mb-6 flex items-center justify-center gap-3">
          <Heart className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
          <span className={`text-sm font-medium uppercase tracking-widest ${heroPhotoUrl ? "text-white" : "text-primary"}`}>
            Our Love Journey
          </span>
          <Heart className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
        </div>

        <h1
          aria-label={fullName}
          className="animate-slide-up font-heading text-2xl leading-tight break-words sm:text-4xl md:text-7xl"
        >
          <span aria-hidden="true">
            <span
              className={`typewriter ${heroPhotoUrl ? "text-white" : "text-foreground"}`}
              style={{ "--chars": displayName1.length } as React.CSSProperties}
            >
              {displayName1}
            </span>
            <span className="mx-4 text-primary">&</span>
            <span
              className={`typewriter ${heroPhotoUrl ? "text-white" : "text-foreground"}`}
              style={
                {
                  "--chars": displayName2.length,
                  // Starts once the first name has finished typing.
                  "--type-delay": `calc(var(--type-char) * ${displayName1.length} + 250ms)`,
                } as React.CSSProperties
              }
            >
              {displayName2}
            </span>
            <span className={`type-caret ${heroPhotoUrl ? "text-white" : "text-primary"}`} />
          </span>
        </h1>

        {/* Painted with the first frame; the typing effect above is pure CSS
            so the text is in the HTML for LCP/SEO and needs no hydration. */}
        <p
          className={`mt-4 text-sm sm:text-lg md:text-xl ${
            heroPhotoUrl ? "text-white/85" : "text-muted-foreground"
          }`}
        >
          {displayTagline}
        </p>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="chevron-bob">
          <button
            type="button"
            onClick={scrollToContent}
            aria-label="Gulir ke konten"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <ChevronDown className={`h-6 w-6 ${heroPhotoUrl ? "text-white/70" : "text-muted-foreground"}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
