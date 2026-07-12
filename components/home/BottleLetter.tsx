"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { X, Heart, Sparkles } from "lucide-react";

const messages = [
  "Kamu itu kayak WiFi, kalau nggak ada, hidupku terasa putus.",
  "You're the reason I check my phone every five minutes.",
  "Aku tuh sayang banget sama kamu, tau. Kayak kucing sayang sama ikan.",
  "I love you more than chicken, and that's saying a lot.",
  "Kamu itu kayak kopi, pahit-pahit bikin nagih.",
  "You're my favorite notification.",
  "Aku mau jadi alasan kamu tersenyum hari ini, besok, dan seterusnya.",
  "I think I'm in love with you, and my heart won't stop dancing.",
  "Kamu itu kayak bensin, bikin hariku berjalan dengan semangat.",
  "You stole my heart, but I'm not pressing charges.",
  "Hari-hari tanpamu tuh kayak nonton film tanpa popcorn — hampa.",
  "Every love story is beautiful, but ours is my favorite.",
  "Kamu itu rumah, tempatku pulang setelah lelah berkelana.",
  "I wish I could look at you the way you look at me — with love.",
  "Aku suka kamu, tapi jangan bilang siapa-siapa, ini rahasia hati.",
  "You're the peanut butter to my jelly.",
  "Kalau kamu jadi soal matematika, aku pasti nggak bisa ngerjain. Soalnya sulit.",
  "I never believed in love at first sight until I saw you.",
  "Kamu itu kayak es krim di siang hari, menyegarkan dan bikin ketagihan.",
  "You're my sunshine on a cloudy day.",
  "Cuma kamu yang bisa bikin aku tersenyum tanpa alasan.",
  "You make my heart go boom boom boom (like a bad bass drop).",
  "Aku sayang kamu, kamu sayang aku? Kalau nggak, aku sayang lagi.",
  "I love you to the moon and back, and then some more.",
  "Kamu itu buku yang nggak pernah aku bosan baca.",
  "You're the best thing that's ever happened to me.",
  "Aku suka cara kamu ngomong 'aku sayang kamu' — walaupun cuma lewat teks.",
  "If you were a vegetable, you'd be a cute-cumber.",
  "Bersamamu, aku ngerasa jadi pangeran/puteri pakai sepatu kaca.",
  "You're my favorite hello and my hardest goodbye.",
  "Aku mau jadi bantalmu — yang selalu kamu peluk pas tidur.",
  "I like you more than sleeping in on weekends.",
  "Kamu itu playlist favoritku — lagunya nggak pernah membosankan.",
  "You're the Google of my heart — you have all the answers.",
  "Kalau kamu jadi pelangi, aku mau jadi hujan yang bikin kamu muncul.",
  "I'd pick you every single time, no hesitation.",
  "Aku suka kamu karena kamu lucu, imut, dan bikin hatiku meleleh.",
  "You're my happy place.",
  "Cuma kamu yang bisa bikin dunia aku berhenti berputar.",
  "I love the way you exist.",
  "Kamu itu kayak gula, manis dan bikin segalanya lebih baik.",
  "You're the missing puzzle piece in my life.",
  "Aku mau jadi saksi bisu perjalanan cinta kita.",
  "I fall for you more and more every single day.",
  "Kamu itu alasan aku bangun pagi dengan senyuman bodoh.",
  "You're the Wi-Fi signal I always want to stay connected to.",
  "Kalau kamu jadi lagu, kamu pasti lagu yang di-repeat terus.",
  "I love you not because of who you are, but because of who I am when I'm with you.",
  "Aku suka ngeliat kamu ketawa, soalnya ketawamu itu lucu.",
  "You make my soul smile.",
  "Kamu itu kayak coklat, manis dan bikin adiksi.",
  "I want to be the reason you look down at your phone and smile.",
  "Aku akan jadi payungmu saat hujan, dan selimutmu saat dingin.",
  "You're the dictionary definition of amazing.",
  "Bersamamu, aku merasa jadi aku yang sebenarnya.",
  "I like you a latte — coffee pun nggak bisa sebanding.",
  "Kamu itu mimpi yang jadi nyata, dan aku nggak mau bangun.",
  "You're the best thing I never knew I needed.",
  "Aku suka cara kamu bilang 'apa kabar' — kayak kamu bener-bener peduli.",
  "I'm not perfect, but I promise to love you perfectly.",
  "Kamu itu kayak bintang jatuh — langka, indah, dan penuh harapan.",
  "You're the song that gets stuck in my head, and I don't mind it.",
  "Aku cinta kamu, kamu, dan cuma kamu. Itu aja.",
  "You're my forever person.",
  "Kalau kamu jadi internet, aku mau jadi kuota tak terbatasmu.",
  "I love you more than words can describe, and my dictionary is pretty big.",
  "Kamu itu kayak pelangi setelah hujan — selalu bikin semuanya baik-baik aja.",
  "You're the reason I believe in love stories.",
  "Bersamamu, aku lupa cara bersedih.",
  "I want to grow old with you and annoy you forever.",
  "Kamu itu kayak mainan favorit waktu kecil, nggak bisa diganti.",
  "You had me at 'halo.'",
  "Kalau misah, kita kayak Netflix dan Chill — nggak lengkap sendiri.",
  "I love the way you make me feel like I'm home.",
  "Kamu itu lucu, imut, manis, dan — eh, apalagi ya — pokoknya sempurna.",
  "You're my favorite notification sound.",
  "Aku mau jadi tempat kamu bersandar saat lelah.",
  "You're the stars in my night sky.",
  "Kamu itu kayak sambal, nggak banyak tapi bikin semuanya lebih mantap.",
  "I choose you. And I'll choose you over and over again.",
  "Aku suka sayang kamu dalam diam, soalnya diamku penuh dengan kamu.",
  "You're the magic in my ordinary days.",
  "Kamu itu kayak angin sepoi-sepoi, bikin adem dan nyaman.",
  "I'd rather be broke with you than rich without you.",
  "Aku iri sama ponselmu, soalnya setiap hari kamu pegang.",
  "You're the gravity that keeps me grounded.",
  "Kamu itu kayak alarm subuh — kamu yang selalu aku tunggu meskipun kadang merepotkan.",
  "I love you more than I love sleeping, and that's a lot.",
  "Kalau kamu jadi puzzle, aku pasti nyusun kamu setiap hari.",
  "You're my in-case-of-emergency break glass person.",
  "Dari sekian banyak orang, kamu yang paling bikin aku baper.",
  "You're my comfort zone.",
  "Aku suka kamu apa adanya, bukan maunya aku.",
  "You make even Mondays bearable.",
  "Kamu itu kayak baterai power bank, selalu nge-charge semangatku.",
  "I want to be the reason your heart feels full.",
  "Cinta aku ke kamu tuh kayak utang — banyak, nggak kebayar-bayar, dan aku ikhlas.",
  "You're the piece of my heart I didn't know was missing.",
  "Bersamamu, everything just feels right.",
  "Kamu itu kayak sinar matahari pagi — hangat dan bikin semangat.",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "idle" | "shaking" | "floating" | "opening" | "emerging" | "unfolding" | "revealed";

function BottleBodySVG() {
  return (
    <svg viewBox="0 0 200 300" className="h-full w-full">
      <defs>
        <clipPath id="bottleClip">
          <path d="M 72,75 L 72,100 C 72,120 35,130 25,170 C 15,215 35,265 100,265 C 165,265 185,215 175,170 C 165,130 128,120 128,100 L 128,75 Z" />
        </clipPath>
        <linearGradient id="glassBody" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(200,220,240,0.25)" />
          <stop offset="40%" stopColor="rgba(200,220,240,0.06)" />
          <stop offset="100%" stopColor="rgba(200,220,240,0.18)" />
        </linearGradient>
        <linearGradient id="bottleLiquid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0.32" />
        </linearGradient>
        <radialGradient id="bottleGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="rgba(251,191,36,0.15)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0)" />
        </radialGradient>
        <filter id="softShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.12)" />
        </filter>
      </defs>

      <ellipse cx="100" cy="272" rx="58" ry="7" fill="rgba(0,0,0,0.08)" />

      <rect x="0" y="0" width="200" height="300" fill="url(#bottleGlow)" clipPath="url(#bottleClip)" />

      <rect x="10" y="165" width="180" height="105" fill="url(#bottleLiquid)" clipPath="url(#bottleClip)" />

      <g clipPath="url(#bottleClip)" opacity="0.65">
        <rect
          x="62"
          y="185"
          width="76"
          height="44"
          rx="4"
          fill="white"
          transform="rotate(-5, 100, 207)"
        />
        <line x1="72" y1="199" x2="128" y2="199" stroke="#D1D5DB" strokeWidth="1.5" />
        <line x1="72" y1="208" x2="120" y2="208" stroke="#D1D5DB" strokeWidth="1.5" />
        <line x1="72" y1="217" x2="124" y2="217" stroke="#D1D5DB" strokeWidth="1.5" />
      </g>

      <path
        d="M 72,75 L 72,100 C 72,120 35,130 25,170 C 15,215 35,265 100,265 C 165,265 185,215 175,170 C 165,130 128,120 128,100 L 128,75 Z"
        fill="url(#glassBody)"
        stroke="rgba(200,220,240,0.35)"
        strokeWidth="2"
        filter="url(#softShadow)"
      />

      <path
        d="M 35,225 C 30,200 35,170 50,150 C 42,170 38,200 40,225 C 42,235 50,245 60,250 C 50,245 40,235 35,225 Z"
        fill="rgba(255,255,255,0.25)"
      />
      <path
        d="M 160,195 C 162,180 158,165 150,155 C 155,165 158,180 155,195 Z"
        fill="rgba(255,255,255,0.12)"
      />

      <rect x="67" y="73" width="66" height="6" rx="3" fill="rgba(200,220,240,0.45)" />
      <rect x="65" y="77" width="70" height="4" rx="2" fill="rgba(200,220,240,0.25)" />

      <rect x="67" y="115" width="66" height="13" rx="3" fill="#F43F5E" />
      <rect x="67" y="115" width="66" height="3" fill="#E11D48" opacity="0.4" />
      <path
        d="M 100,121 C 88,114 77,117 81,124 C 85,131 95,127 100,121 Z"
        fill="#F43F5E"
      />
      <path
        d="M 100,121 C 112,114 123,117 119,124 C 115,131 105,127 100,121 Z"
        fill="#E11D48"
      />
      <path
        d="M 100,128 C 95,139 88,144 85,147"
        stroke="#F43F5E"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100,128 C 105,139 112,144 115,147"
        stroke="#E11D48"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      <g transform="translate(100, 225)">
        <path
          d="M 0,-7 C -4,-13 -11,-11 -11,-5 C -11,1 0,9 0,13 C 0,9 11,1 11,-5 C 11,-11 4,-13 0,-7 Z"
          fill="#F43F5E"
          opacity="0.75"
        />
      </g>
    </svg>
  );
}

function CorkSVG() {
  return (
    <svg viewBox="0 0 56 32" className="h-full w-full">
      <rect x="2" y="4" width="52" height="26" rx="5" fill="#D4A574" />
      <rect x="2" y="2" width="52" height="8" rx="4" fill="#E8C9A0" />
      <line x1="6" y1="16" x2="50" y2="16" stroke="#C49560" strokeWidth="1.2" opacity="0.4" />
      <line x1="5" y1="22" x2="51" y2="22" stroke="#C49560" strokeWidth="1.2" opacity="0.4" />
      <rect x="2" y="22" width="52" height="8" rx="3" fill="rgba(0,0,0,0.06)" />
    </svg>
  );
}

function EnvelopeContent({ phase }: { phase: Phase }) {
  const isOpen = phase === "unfolding";
  return (
    <div className="relative h-full w-full" style={{ perspective: "1000px" }}>
      <motion.div
        className="absolute inset-x-[10%] inset-y-[16%] z-0 rounded-sm bg-white/90"
        initial={false}
        animate={{
          y: isOpen ? 0 : 3,
          opacity: isOpen ? 1 : 0.15,
        }}
        transition={{ duration: 0.6, delay: isOpen ? 0.3 : 0, ease: "easeOut" }}
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <div className="flex flex-col gap-1.5 p-2.5 pt-3.5">
          <div className="h-0.5 w-3/4 rounded-full bg-rose-100" />
          <div className="h-0.5 w-1/2 rounded-full bg-rose-100" />
          <div className="h-0.5 w-2/3 rounded-full bg-rose-100" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-lg border border-amber-300/50 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg">
        <div
          className="absolute bottom-0 left-0 right-0 h-1/2"
          style={{
            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            background: "linear-gradient(to top, rgba(245,230,208,0.8), transparent)",
          }}
        />
      </div>

      <motion.div
        className="absolute top-0 left-0 right-0 z-20 h-[55%]"
        style={{
          clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
          background: "linear-gradient(160deg, #f0dfc5, #e8d5b5)",
          transformOrigin: "center bottom",
          backfaceVisibility: "hidden",
          boxShadow: isOpen ? "none" : "0 -1px 3px rgba(0,0,0,0.06)",
        }}
        animate={{ rotateX: isOpen ? -120 : 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2">
          <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
        </div>
      </motion.div>
    </div>
  );
}

function orbitKeyframes(offset: number, count: number = 9) {
  const rx = 48;
  const ry = 32;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (((360 / (count - 1)) * i + offset) * Math.PI) / 180;
    x.push(Math.round(rx * Math.cos(angle) * 10) / 10);
    y.push(Math.round(ry * Math.sin(angle) * 10) / 10);
  }
  return { x, y };
}

const orbits = [
  orbitKeyframes(0),
  orbitKeyframes(90),
  orbitKeyframes(180),
  orbitKeyframes(270),
];

export default function BottleLetter() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayText, setDisplayText] = useState("");
  const [confetti, setConfetti] = useState<
    { x: number; y: number; rot: number; delay: number; emoji: string }[]
  >([]);
  const [afterglow, setAfterglow] = useState(false);

  const shuffledRef = useRef(shuffle(messages));
  const indexRef = useRef(0);

  const nextMessage = (): string => {
    if (indexRef.current >= messages.length) {
      shuffledRef.current = shuffle(messages);
      indexRef.current = 0;
    }
    return shuffledRef.current[indexRef.current++];
  };

  const handleOpen = () => {
    if (phase !== "idle") return;

    setPhase("shaking");

    setTimeout(() => setPhase("floating"), 800);
    setTimeout(() => setPhase("opening"), 1800);
    setTimeout(() => setPhase("emerging"), 2800);
    setTimeout(() => setPhase("unfolding"), 4200);
    setTimeout(() => {
      setMessage(nextMessage());
      setOpen(true);
      setPhase("revealed");
    }, 5500);
  };

  const handleClose = () => {
    setOpen(false);
    setAfterglow(true);
    setTimeout(() => {
      setPhase("idle");
      setConfetti([]);
      setTimeout(() => setAfterglow(false), 1000);
    }, 600);
  };

  useEffect(() => {
    if (phase === "opening") {
      setConfetti(
        Array.from({ length: 14 }, (_, i) => ({
          x: (Math.random() - 0.5) * 220,
          y: -(Math.random() * 140 + 30),
          rot: Math.random() * 360,
          delay: Math.random() * 0.18,
          emoji: ["❤️", "✨", "💫", "🌟", "🦋", "💖", "⭐"][i % 7],
        })),
      );
    } else {
      setConfetti([]);
    }
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    setDisplayText("");
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx <= message.length) {
        setDisplayText(message.slice(0, idx));
      } else {
        clearInterval(interval);
      }
    }, 55);
    return () => clearInterval(interval);
  }, [open, message]);

  const swayVariants = {
    idle: {
      y: [0, -4, 0],
      rotate: [0, 2, -2, 0],
      transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
    },
    hover: {
      y: [0, -6, 0],
      rotate: [0, 3, -3, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
    },
  };

  const hintLabels: Record<Phase, string> = {
    idle: "Klik botol untuk baca pesan",
    shaking: "Botol terbuka... ✨",
    floating: "Membuka botol... 💫",
    opening: "Menyiapkan pesan... 🌟",
    emerging: "Amplop terangkat... 💌",
    unfolding: "Membuka amplop... 💖",
    revealed: "Siap dibaca ❤️",
  };

  const modalConfetti = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        left: 5 + i * 9,
        delay: i * 0.15 + 0.3,
        emoji: ["❤️", "✨", "💫", "🌟", "🦋"][i % 5],
        drift: (Math.random() - 0.5) * 30,
      })),
    [],
  );

  return (
    <>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md overflow-hidden"
    >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
          </div>
          <span className="text-base font-medium">What's in the bottle</span>
        </div>

        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.97 }}
          className={`group relative flex w-full cursor-pointer flex-col items-center justify-center ${phase === "emerging" || phase === "unfolding" ? "" : "overflow-hidden"} rounded-xl bg-gradient-to-b from-amber-50 via-rose-50/30 to-amber-100/50 py-14 transition-all duration-500 hover:from-amber-100 hover:to-amber-200/50 dark:from-amber-950/30 dark:via-rose-900/10 dark:to-amber-900/20 dark:hover:from-amber-900/40 dark:hover:to-amber-800/30`}
          style={{
            boxShadow:
              phase !== "idle" || afterglow
                ? "0 0 30px rgba(251,191,36,0.2), 0 0 60px rgba(244,63,94,0.1)"
                : undefined,
          }}
        >
          {/* Wave decoration */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 opacity-25">
            <motion.svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              className="h-full w-full"
              animate={{ x: [0, -100, 0] }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <defs>
                <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#F43F5E" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path
                d="M 0,30 C 40,10 80,50 120,30 C 160,10 200,50 240,30 C 280,10 320,50 360,30 S 400,60 0,60 Z"
                fill="url(#wave1)"
              />
            </motion.svg>
            <motion.svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              animate={{ x: [0, 100, 0] }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <path
                d="M 0,35 C 60,15 120,55 180,35 C 240,15 300,55 360,35 C 400,25 400,60 0,60 Z"
                fill="url(#wave2)"
              />
            </motion.svg>
          </div>

          {/* Ambient particles — idle */}
          {phase === "idle" &&
            !afterglow &&
            Array.from({ length: 8 }, (_, i) => (
              <motion.div
                key={`ap-${i}`}
                className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-400/30"
                style={{
                  left: `${12 + ((i * 11) % 76)}%`,
                  bottom: `${15 + ((i * 10) % 70)}%`,
                }}
                animate={{
                  y: [-40 - (i % 3) * 20, -90 - (i % 3) * 30],
                  x: [
                    0,
                    (i % 2 === 0 ? 10 : -10) * (1 + (i % 3)),
                    0,
                  ],
                  opacity: [0, 0.6, 0],
                  scale: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 5 + (i % 4),
                  repeat: Infinity,
                  delay: i * 0.45,
                  ease: "easeInOut",
                }}
              />
            ))}

          {/* Afterglow particles */}
          {afterglow &&
            Array.from({ length: 4 }, (_, i) => (
              <motion.div
                key={`ag-${i}`}
                className="pointer-events-none absolute h-2 w-2 rounded-full bg-rose-400/30"
                style={{
                  left: `${30 + i * 13}%`,
                  bottom: `${20 + i * 15}%`,
                }}
                animate={{
                  y: [-20, -60],
                  opacity: [0.4, 0],
                  scale: [1, 0.3],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut",
                }}
              />
            ))}

          {/* Ripple rings — shaking */}
          {phase === "shaking" &&
            Array.from({ length: 3 }, (_, i) => (
              <motion.div
                key={`rr-${i}`}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/40"
                initial={{ width: 4, height: 4, opacity: 0.6 }}
                animate={{ width: 260, height: 260, opacity: 0 }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  ease: "easeOut",
                }}
              />
            ))}

          {/* Background glow pulse — floating */}
          {(phase === "floating" || phase === "opening") && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(251,191,36,0.15), transparent 70%)",
              }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
          
          {/* Main bottle container */}
          <motion.div
            className="relative mx-auto w-36 sm:w-44"
            style={{ aspectRatio: "2 / 3" }}
            animate={{
              scale:
                phase === "idle" ||
                phase === "revealed" ||
                phase === "emerging" ||
                phase === "unfolding"
                  ? 1
                  : 1.35,
              y:
                phase === "idle" ||
                phase === "revealed" ||
                phase === "emerging" ||
                phase === "unfolding"
                  ? 0
                  : phase === "shaking"
                    ? -8
                    : -24,
            }}
            transition={
              phase === "shaking"
                ? { type: "spring", damping: 6, stiffness: 150 }
                : { type: "spring", damping: 8, stiffness: 100 }
            }
          >
            {/* Shaking vibration */}
            {phase === "shaking" && (
              <motion.div
                className="absolute inset-0"
                animate={{
                  rotate: [0, -3, 3, -2, 2, -1, 1, 0],
                  x: [0, -2, 2, -1, 1, 0],
                }}
                transition={{
                  duration: 0.8,
                  ease: "easeInOut",
                }}
              >
                <div className="absolute inset-0">
                  <BottleBodySVG />
                </div>
              </motion.div>
            )}

            {/* Normal sway — non-shaking */}
            {phase !== "shaking" && (
              <motion.div
                className="absolute inset-0"
                variants={swayVariants}
                animate={
                  phase === "idle"
                    ? isHovered
                      ? "hover"
                      : "idle"
                    : { y: 0, rotate: 0 }
                }
              >
                <BottleBodySVG />
              </motion.div>
            )}

            {/* Cork */}
            {phase !== "revealed" && phase !== "emerging" && phase !== "unfolding" && (
              <motion.div
                className="absolute"
                style={{ left: "36%", top: "15%", width: "28%" }}
                animate={
                  phase === "opening"
                    ? {
                        x: 90,
                        y: -140,
                        rotate: 45,
                        opacity: 0,
                        scale: 0.3,
                      }
                    : { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }
                }
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                }}
              >
                <CorkSVG />
              </motion.div>
            )}

            {/* Heart orbit — floating */}
            {phase === "floating" &&
              orbits.map((orbit, i) => (
                <motion.span
                  key={`ho-${i}`}
                  className="pointer-events-none absolute text-lg"
                  style={{
                    left: "calc(50% - 9px)",
                    top: "calc(50% - 9px)",
                  }}
                  animate={{
                    x: orbit.x,
                    y: orbit.y,
                    opacity: [0.3, 0.8, 0.3],
                    scale: [0.6, 1.1, 0.6],
                  }}
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  ❤️
                </motion.span>
              ))}

            {/* Trail dots — floating */}
            {phase === "floating" &&
              Array.from({ length: 4 }, (_, i) => (
                <motion.div
                  key={`td-${i}`}
                  className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-400/50"
                  style={{
                    left: `${43 + (i - 1) * 5}%`,
                    top: "70%",
                  }}
                  animate={{
                    y: [-8, -28 - i * 5],
                    opacity: [0, 0.5, 0],
                    scale: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.35,
                    ease: "easeOut",
                  }}
                />
              ))}

            {/* Ripple rings — opening (from bottle mouth) */}
            {phase === "opening" &&
              Array.from({ length: 2 }, (_, i) => (
                <motion.div
                  key={`op-${i}`}
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-amber-300/50"
                  style={{ top: "14%" }}
                  initial={{ width: 10, height: 10, opacity: 0.7 }}
                  animate={{ width: 180, height: 60, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.35,
                    ease: "easeOut",
                  }}
                />
              ))}

            {/* Light beam — opening */}
            {phase === "opening" && (
              <motion.div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                style={{ top: "10%", width: 3 }}
                initial={{ height: 0, opacity: 0.5 }}
                animate={{ height: 100, opacity: 0 }}
                transition={{ duration: 1.8, ease: "easeOut" }}
              >
                <div className="h-full w-full rounded-full bg-gradient-to-b from-amber-300 via-amber-400/50 to-transparent" />
              </motion.div>
            )}

            {/* Brightness flash — opening */}
            {phase === "opening" && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                style={{
                  background:
                    "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 60%)",
                }}
              />
            )}

            {/* Confetti burst — opening */}
            {phase === "opening" &&
              confetti.map((p, i) => (
                <motion.span
                  key={`cf-${i}`}
                  className="pointer-events-none absolute text-base"
                  style={{ left: "50%", top: "30%" }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    opacity: 0,
                    scale: [0.3, 1.2, 0.4],
                    rotate: p.rot,
                  }}
                  transition={{
                    duration: 2.5,
                    delay: p.delay,
                    ease: "easeOut",
                  }}
                >
                  {p.emoji}
                </motion.span>
              ))}

            {/* Envelope — emerging / unfolding */}
            {(phase === "emerging" || phase === "unfolding") && (
              <motion.div
                className="absolute z-30"
                initial={{
                  width: 24,
                  height: 18,
                  left: "calc(50% - 12px)",
                  top: "20%",
                  opacity: 0,
                }}
                animate={{
                  width: 160,
                  height: 115,
                  left: "calc(50% - 80px)",
                  top: "-25%",
                  opacity: 1,
                }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              >
                <EnvelopeContent phase={phase} />
              </motion.div>
            )}
          </motion.div>

          {/* Hint text */}
          <motion.span
            className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-300"
            animate={
              phase === "idle"
                ? { opacity: [0.6, 1, 0.6] }
                : { opacity: 1 }
            }
              transition={{
                duration: 3,
                repeat: phase === "idle" ? Infinity : 0,
              }}
          >
            {hintLabels[phase]}
          </motion.span>

          <div className="absolute inset-0 rounded-xl ring-1 ring-amber-200/50 transition-colors group-hover:ring-amber-300/70 dark:ring-amber-800/30 dark:group-hover:ring-amber-700/50" />
        </motion.button>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotateY: 90 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.7, opacity: 0, rotateY: -90 }}
              transition={{ type: "spring", damping: 10, stiffness: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-8 text-center shadow-2xl dark:border-amber-800 dark:from-amber-950 dark:via-stone-900 dark:to-amber-950"
            >
              {/* Modal confetti */}
              {modalConfetti.map((mc, i) => (
                <motion.span
                  key={`mc-${i}`}
                  className="pointer-events-none absolute z-0 text-base"
                  style={{ top: "-5%", left: `${mc.left}%` }}
                  initial={{ y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    y: "110vh",
                    opacity: [1, 1, 0],
                    rotate: 360,
                    x: mc.drift,
                  }}
                  transition={{
                    duration: 4,
                    delay: mc.delay,
                    ease: "easeIn",
                  }}
                >
                  {mc.emoji}
                </motion.span>
              ))}

              {/* Floating hearts in modal background */}
              {Array.from({ length: 4 }, (_, i) => (
                <motion.span
                  key={`mh-${i}`}
                  className="pointer-events-none absolute z-0 text-lg"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{
                    y: "-10%",
                    opacity: [0, 0.4, 0],
                    x: [0, (i % 2 === 0 ? 8 : -8), 0],
                  }}
                  transition={{
                    duration: 8 + i,
                    repeat: Infinity,
                    delay: i * 1.2,
                    ease: "easeInOut",
                  }}
                  style={{ left: `${12 + i * 25}%` }}
                >
                  ❤️
                </motion.span>
              ))}
              {Array.from({ length: 3 }, (_, i) => (
                <motion.span
                  key={`ms-${i}`}
                  className="pointer-events-none absolute z-0 text-sm"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{
                    y: "-5%",
                    opacity: [0, 0.3, 0],
                    x: [0, (i % 2 === 0 ? -6 : 6), 0],
                  }}
                  transition={{
                    duration: 10 + i,
                    repeat: Infinity,
                    delay: i * 1.8,
                    ease: "easeInOut",
                  }}
                  style={{ left: `${28 + i * 22}%` }}
                >
                  ✨
                </motion.span>
              ))}

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-all hover:scale-110 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Envelope */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: [0, -8, 8, 0] }}
                transition={{
                  delay: 0.3,
                  type: "tween",
                  ease: "easeInOut",
                  duration: 1,
                }}
                className="relative z-10 mb-4 text-5xl"
              >
                <motion.span
                  className="inline-block"
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    delay: 1,
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  💌
                </motion.span>
              </motion.div>

              {/* Typewriter text */}
              <div className="relative z-10 min-h-[3.5rem]">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-heading text-lg italic leading-relaxed text-foreground md:text-xl"
                >
                  <span>&ldquo;</span>
                  {displayText}
                  {displayText.length < message.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                      }}
                      className="inline-block"
                    >
                      |
                    </motion.span>
                  )}
                  <span>&rdquo;</span>
                </motion.p>
              </div>

              {/* Made with love */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="relative z-10 mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
              >
                <Heart className="h-3 w-3 fill-primary text-primary" />
                <span>Made with love</span>
                <Heart className="h-3 w-3 fill-primary text-primary" />
              </motion.div>

              {/* Decorative line */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 1.5, duration: 1.2, ease: "easeInOut" }}
                className="relative z-10 mx-auto mt-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              />

              {/* Close button */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
                onClick={handleClose}
                className="relative z-10 mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-all hover:scale-105 hover:bg-primary/20"
              >
                <Sparkles className="h-3 w-3" />
                Tutup
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
