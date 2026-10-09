"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Heart } from "lucide-react";
import { isVideoUrl } from "@/lib/utils";
import { cropCoverStyle, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";
import { DEFAULT_NAME1, DEFAULT_NAME2, nickname, resolveTagline } from "@/lib/couple-display";

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
  // Eyebrow uses first-word nicknames ("Niko Dwicahyo" -> "Niko"); the
  // main title keeps the full names from settings.
  const eyebrowName = `${nickname(displayName1, DEFAULT_NAME1)} & ${nickname(displayName2, DEFAULT_NAME2)}`;
  const heroIsVideo = useMemo(() => isVideoUrl(heroPhotoUrl), [heroPhotoUrl]);
  const reduceMotion = useReducedMotion();
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
  // ponytail: SSR-safe initials (server useReducedMotion() is null).
  // The effect below syncs reduced-motion + name changes on mount,
  // so first client render always matches SSR HTML — no hydration mismatch.
  const [displayedName1, setDisplayedName1] = useState("");
  const [displayedName2, setDisplayedName2] = useState("");
  const [showCursor1, setShowCursor1] = useState(true);
  const [showCursor2, setShowCursor2] = useState(false);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedName1(displayName1);
      setDisplayedName2(displayName2);
      setShowCursor1(false);
      setShowCursor2(false);
      setTypingDone(true);
      return;
    }
    let i = 0;
    let interval2: ReturnType<typeof setInterval> | null = null;
    setDisplayedName1("");
    setDisplayedName2("");
    setShowCursor1(true);
    setTypingDone(false);
    const interval1 = setInterval(() => {
      if (i < displayName1.length) {
        setDisplayedName1(displayName1.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval1);
        setShowCursor1(false);
        setShowCursor2(true);

        let j = 0;
        const inner = setInterval(() => {
          if (j < displayName2.length) {
            setDisplayedName2(displayName2.slice(0, j + 1));
            j++;
          } else {
            clearInterval(inner);
            setShowCursor2(false);
            setTypingDone(true);
          }
        }, 80);
        interval2 = inner;
      }
    }, 100);

    return () => {
      clearInterval(interval1);
      if (interval2) {
        clearInterval(interval2);
        interval2 = null;
      }
    };
  }, [displayName1, displayName2, reduceMotion]);

  const scrollToContent = () => {
    document.getElementById("home-content")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };

  const heroAlt = `${displayName1} dan ${displayName2}`;

  return (
    <section
      aria-label={fullName}
      className="relative flex min-h-[90svh] items-center justify-center overflow-hidden"
      style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
    >
      {heroPhotoUrl ? (
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_90%,transparent)]">
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
          className="mb-6 flex items-center justify-center gap-3"
        >
          <Heart className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
          <span className={`text-sm font-medium uppercase tracking-widest ${heroPhotoUrl ? "text-white" : "text-primary"}`}>
            {eyebrowName} Journey
          </span>
          <Heart className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          aria-label={fullName}
          className="font-heading text-2xl leading-tight break-words sm:text-4xl md:text-7xl"
        >
          <span aria-hidden="true">
            <span className={heroPhotoUrl ? "text-white" : "text-foreground"}>{displayedName1}</span>
            {showCursor1 && (
              <span className="ml-0.5 animate-pulse text-primary">|</span>
            )}
            <span className="mx-4 text-primary">&</span>
            <span className={heroPhotoUrl ? "text-white" : "text-foreground"}>{displayedName2}</span>
            {showCursor2 && (
              <span className="ml-0.5 animate-pulse text-primary">|</span>
            )}
          </span>
        </motion.h1>

        {typingDone && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 0.3 }}
            className={`mt-4 text-sm sm:text-lg md:text-xl ${heroPhotoUrl ? "text-white/85" : "text-muted-foreground"}`}
          >
            {displayTagline}
          </motion.p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: typingDone ? 0.5 : 2, duration: reduceMotion ? 0 : 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={reduceMotion ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <button
            type="button"
            onClick={scrollToContent}
            aria-label="Gulir ke konten"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <ChevronDown className={`h-6 w-6 ${heroPhotoUrl ? "text-white/70" : "text-muted-foreground"}`} aria-hidden="true" />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
