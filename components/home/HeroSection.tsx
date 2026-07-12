"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronDown, Heart } from "lucide-react";
import { isVideoUrl } from "@/lib/utils";

type HeroSectionProps = {
  name1?: string;
  name2?: string;
  tagline?: string | null;
  heroPhotoUrl?: string | null;
};

export default function HeroSection({
  name1 = "Kamu",
  name2 = "Pasangan",
  tagline,
  heroPhotoUrl,
}: HeroSectionProps) {
  const heroIsVideo = useMemo(() => isVideoUrl(heroPhotoUrl), [heroPhotoUrl]);
  const [displayedName1, setDisplayedName1] = useState("");
  const [displayedName2, setDisplayedName2] = useState("");
  const [showCursor1, setShowCursor1] = useState(true);
  const [showCursor2, setShowCursor2] = useState(false);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    let i = 0;
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
        const interval2 = setInterval(() => {
          if (j < name2.length) {
            setDisplayedName2(name2.slice(0, j + 1));
            j++;
          } else {
            clearInterval(interval2);
            setShowCursor2(false);
            setTypingDone(true);
          }
        }, 80);
      }
    }, 100);

    return () => {
      clearInterval(interval1);
    };
  }, [name1, name2]);

  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
      {heroPhotoUrl ? (
        <div className="absolute inset-0">
          {heroIsVideo ? (
            <video
              src={heroPhotoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={heroPhotoUrl}
              alt=""
              fill
              className="object-cover"
              priority
              loading="eager"
              fetchPriority="high"
              sizes="100vw"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/30" />
      )}

      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
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
