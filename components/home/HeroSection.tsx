"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronDown, Heart } from "lucide-react";
import { isVideoUrl } from "@/lib/utils";
import { cropCoverStyle, type CropRect } from "@/lib/image-crop";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

type HeroSectionProps = {
  name1?: string;
  name2?: string;
  tagline?: string | null;
  heroPhotoUrl?: string | null;
  heroCrop?: CropRect | null;
};

export default function HeroSection({
  name1 = "Kamu",
  name2 = "Pasangan",
  tagline,
  heroPhotoUrl,
  heroCrop = null,
}: HeroSectionProps) {
  const heroIsVideo = useMemo(() => isVideoUrl(heroPhotoUrl), [heroPhotoUrl]);
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
  const [displayedName1, setDisplayedName1] = useState("");
  const [displayedName2, setDisplayedName2] = useState("");
  const [showCursor1, setShowCursor1] = useState(true);
  const [showCursor2, setShowCursor2] = useState(false);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let interval2: ReturnType<typeof setInterval> | null = null;
    setShowCursor1(true);
    const interval1 = setInterval(() => {
      if (i < name1.length) {
        setDisplayedName1(name1.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval1);
        setShowCursor1(false);
        setShowCursor2(true);

        let j = 0;
        const inner = setInterval(() => {
          if (j < name2.length) {
            setDisplayedName2(name2.slice(0, j + 1));
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
  }, [name1, name2]);

  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
      {heroPhotoUrl ? (
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_90%,transparent)]">
          {heroIsVideo ? (
            <video
              src={heroPhotoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : cropStyle ? (
            <Image
              src={getOptimizedImageUrl(heroPhotoUrl, 1600)}
              alt=""
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
              alt=""
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

      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center [paint-order:stroke] [-webkit-text-stroke:1.25px_rgba(255,255,255,0.9)] dark:[-webkit-text-stroke:1.25px_rgba(0,0,0,0.85)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-6 flex items-center justify-center gap-3"
        >
          <Heart className="h-5 w-5 fill-primary text-primary" />
          <span className="text-sm font-medium uppercase tracking-widest text-primary">
            Niko & Dzikria Journey
          </span>
          <Heart className="h-5 w-5 fill-primary text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="font-heading text-2xl leading-tight sm:text-4xl md:text-7xl break-words"
        >
          <span className="text-foreground">{displayedName1}</span>
          {showCursor1 && (
            <span className="ml-0.5 animate-pulse text-primary">|</span>
          )}
          <span className="mx-4 text-primary">&</span>
          <span className="text-foreground">{displayedName2}</span>
          {showCursor2 && (
            <span className="ml-0.5 animate-pulse text-primary">|</span>
          )}
        </motion.h1>

        {tagline && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={typingDone ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-4 text-sm text-muted-foreground sm:text-lg md:text-xl"
          >
            {tagline}
          </motion.p>
        )}

        {!tagline && typingDone && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-4 text-sm text-muted-foreground sm:text-lg md:text-xl"
          >
            Tempat semua cerita kita tersimpan selamanya.
          </motion.p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: typingDone ? 0.5 : 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
}
