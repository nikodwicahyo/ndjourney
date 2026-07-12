"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Heart,
  RotateCcw,
  Star,
  Zap,
  Check,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryPhoto = {
  id: string;
  url: string;
  isVideo: boolean;
};

type Card = {
  pairId: string;
  uid: string;
  url: string;
  matched: boolean;
};

type MemoryMatchProps = {
  photos: GalleryPhoto[];
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initCards(selected: GalleryPhoto[]): Card[] {
  const pairs: Card[] = [];
  for (const p of selected) {
    pairs.push({ pairId: p.id, uid: `${p.id}-a`, url: p.url, matched: false });
    pairs.push({ pairId: p.id, uid: `${p.id}-b`, url: p.url, matched: false });
  }
  return shuffleArray(pairs);
}

export default function MemoryMatch({ photos }: MemoryMatchProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const photoPool = useMemo(() => photos.filter((p) => !p.isVideo), [photos]);
  const [mounted, setMounted] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);

  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [won, setWon] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [justMatched, setJustMatched] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [gameStarted, setGameStarted] = useState(false);

  const pairCount = cards.length / 2;

  const flippedRef = useRef<string[]>([]);
  const lockRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const pool = photoPool.length >= 2
      ? photoPool
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-${i}`,
          url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${["#F43F5E","#BE185D","#E11D48","#FB7185","#F43F5E","#BE185D"][i]}"/><text x="100" y="115" text-anchor="middle" font-size="60" fill="white">♥</text></svg>`)}`,
          isVideo: false,
        }));
    const s = shuffleArray(pool).slice(0, 6);
    setCards(initCards(s));
    setMounted(true);
  }, [photoPool]);

  useEffect(() => {
    if (!startTimeRef.current || won) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, won]);

  const handleFlip = useCallback((uid: string) => {
    if (lockRef.current) return;
    if (cards.length === 0) return;

    const curFlipped = flippedRef.current;
    if (curFlipped.includes(uid)) return;
    if (curFlipped.length >= 2) return;

    if (!startedRef.current) {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      setGameStarted(true);
    }

    const newFlipped = [...curFlipped, uid];
    flippedRef.current = newFlipped;
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      lockRef.current = true;

      const card1 = cards.find((c) => c.uid === newFlipped[0]);
      const card2 = cards.find((c) => c.uid === newFlipped[1]);

      if (!card1 || !card2) {
        flippedRef.current = [];
        setFlippedIds([]);
        lockRef.current = false;
        return;
      }

      if (card1.pairId === card2.pairId) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.pairId === card1.pairId ? { ...c, matched: true } : c,
            ),
          );
          setMatchedCount((m) => m + 1);
          setJustMatched(card1.pairId);
          setTimeout(() => setJustMatched(null), 1200);
          flippedRef.current = [];
          setFlippedIds([]);
          lockRef.current = false;
        }, 400);
      } else {
        setTimeout(() => {
          flippedRef.current = [];
          setFlippedIds([]);
          lockRef.current = false;
        }, 800);
      }
    }
  }, [cards]);

  useEffect(() => {
    if (matchedCount === pairCount && pairCount > 0 && startTimeRef.current) {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setTimeout(() => setWon(true), 600);
    }
  }, [matchedCount, pairCount]);

  const handleNewGame = () => {
    const pool = photoPool.length >= 2
      ? photoPool
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-${i}`,
          url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${["#F43F5E","#BE185D","#E11D48","#FB7185","#F43F5E","#BE185D"][i]}"/><text x="100" y="115" text-anchor="middle" font-size="60" fill="white">♥</text></svg>`)}`,
          isVideo: false,
        }));
    const s = shuffleArray(pool).slice(0, 6);
    setCards(initCards(s));
    flippedRef.current = [];
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
    setWon(false);
    setElapsed(0);
    setJustMatched(null);
    lockRef.current = false;
    startTimeRef.current = null;
    startedRef.current = false;
    setGameStarted(false);
  };

  const handleImgError = useCallback((uid: string) => {
    setImgErrors((prev) => new Set(prev).add(uid));
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md overflow-hidden"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-base font-medium">Memory Match</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Klik kartu untuk membuka. Cocokkan semua pasangan gambar dengan
            langkah paling sedikit.
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {matchedCount}/{pairCount} pasang
        </span>
        <div className="flex items-center gap-3">
          {gameStarted && (
            <span className="tabular-nums">{formatTime(elapsed)}</span>
          )}
          <span className="tabular-nums">{moves} langkah</span>
          <button
            onClick={handleNewGame}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Game baru"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map((card, idx) => {
          const isRevealed = flippedIds.includes(card.uid) || card.matched;
          const isMatchedNow = justMatched === card.pairId;
          const hasError = imgErrors.has(card.uid);

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10" />
            <span className="text-base font-medium">Memory Match</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
            <motion.div
              key={card.uid}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: isMatchedNow ? 1.12 : 1,
              }}
              transition={{
                delay: idx * 0.02,
                duration: 0.35,
                scale: isMatchedNow
                  ? { duration: 0.4, ease: "easeInOut", repeat: 1, repeatType: "mirror" }
                  : undefined,
              }}
              className={cn(
                "aspect-square rounded-xl",
                card.matched && "ring-2 ring-primary/40",
              )}
              style={{ perspective: "600px" }}
            >
              <button
                onClick={() => handleFlip(card.uid)}
                disabled={card.matched}
                className={cn(
                  "relative h-full w-full rounded-xl transition-transform duration-[400ms] active:scale-95",
                )}
                style={{
                  transformStyle: "preserve-3d",
                  transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* FRONT — heart (visible at 0deg) */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <Heart className="h-6 w-6 text-primary/40" />
                </div>

                {/* BACK — image (visible at 180deg) */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-xl bg-muted"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {hasError || card.url.startsWith("data:") ? (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20">
                      <Heart className="h-8 w-8 text-primary/60" />
                    </div>
                  ) : (
                    <div className="relative h-full w-full">
                      <Image
                        src={card.url}
                        alt=""
                        fill
                        sizes="25vw"
                        className="object-cover"
                        onError={() => handleImgError(card.uid)}
                      />
                    </div>
                  )}

                  {card.matched && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-brightness-110">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, rotate: [0, -15, 15, 0] }}
                        transition={{
                          scale: { type: "spring", damping: 12, stiffness: 200 },
                          rotate: { duration: 0.4, ease: "easeInOut" },
                        }}
                      >
                        <Check className="h-8 w-8 text-primary drop-shadow-md" />
                      </motion.div>
                    </div>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Match toast */}
      <AnimatePresence>
        {justMatched && (
          <motion.div
            key={justMatched}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary"
          >
            <Check className="h-3.5 w-3.5" />
            Cocok! ({matchedCount}/{pairCount})
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win screen */}
      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-5 text-center"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, type: "tween", ease: "easeInOut" }}
              className="mb-2"
            >
              <PartyPopper className="mx-auto h-6 w-6 text-primary" />
            </motion.div>
            <div className="flex items-center justify-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-lg font-semibold text-primary">
                Selamat! Semua cocok!
              </span>
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {moves} langkah &middot; {formatTime(elapsed)}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleNewGame}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="h-3 w-3" />
              Main lagi
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
