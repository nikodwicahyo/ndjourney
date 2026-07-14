"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSubmitArcadeScore } from "@/hooks/useGames";
import { Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Heart,
  RotateCcw,
  Trophy,
  Zap,
  Star,
} from "lucide-react";

const ROUNDS = 5;
const DARTS_PER_ROUND = 3;
const TOTAL_DARTS = ROUNDS * DARTS_PER_ROUND;
const BOARD_RADIUS_PCT = 42;
const CHARGE_DURATION_MS = 1500;

type Phase =
  | "idle"
  | "aiming"
  | "throwing"
  | "scoring"
  | "round_transition"
  | "complete";

type Ring =
  | "bullseye"
  | "inner"
  | "middle"
  | "outer"
  | "mid"
  | "inner2"
  | "outer2"
  | "miss";

type DartResult = {
  id: number;
  x: number;
  y: number;
  score: number;
  ring: Ring;
  streak: number;
  power: number;
};

type ScorePopup = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
};

type Particle = {
  id: number;
  baseX: number;
  baseY: number;
  emoji: string;
  delay: number;
  duration: number;
  offsetX: number;
  offsetY: number;
};

const RING_CONFIG: Record<Ring, { color: string; label: string; points: number; radius: number }> = {
  bullseye: { color: "#FF6B9D", label: "100", points: 100, radius: 0.08 },
  inner: { color: "#FF8FB1", label: "90", points: 90, radius: 0.15 },
  middle: { color: "#E8A0D4", label: "80", points: 80, radius: 0.22 },
  outer: { color: "#C9B1FF", label: "70", points: 70, radius: 0.3 },
  mid: { color: "#B8C5FF", label: "50", points: 50, radius: 0.4 },
  inner2: { color: "#A0D4E8", label: "30", points: 30, radius: 0.55 },
  outer2: { color: "#8FFFE8", label: "10", points: 10, radius: 0.7 },
  miss: { color: "#F1F5F9", label: "0", points: 0, radius: 1.0 },
};

type LoveDartsProps = {
  playerName?: string;
};

function getRing(distanceRatio: number): { ring: Ring; score: number } {
  const entries = Object.entries(RING_CONFIG) as [Ring, typeof RING_CONFIG[Ring]][];
  for (const [ring, cfg] of entries) {
    if (distanceRatio <= cfg.radius) return { ring, score: cfg.points };
  }
  return { ring: "miss", score: 0 };
}

function getRating(score: number) {
  if (score >= 1800) return { label: "Legendary Lover", emoji: "\uD83D\uDC9E", color: "text-yellow-400" };
  if (score >= 1400) return { label: "Sharp Shooter", emoji: "\uD83D\uDC98", color: "text-pink-400" };
  if (score >= 1000) return { label: "Getting Warm", emoji: "\u2764\uFE0F", color: "text-rose-400" };
  if (score >= 700) return { label: "Keep Practicing", emoji: "\uD83D\uDC94", color: "text-orange-400" };
  return { label: "Love Needs Practice", emoji: "\uD83E\uDD72", color: "text-muted-foreground" };
}

const CONFETTI_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDC9B", "\uD83D\uDC9C", "\uD83D\uDC9D", "\uD83E\uDE78", "\u2728", "\u2B50", "\uD83C\uDF1F", "\uD83D\uDC96", "\uD83D\uDC97"];

export default function LoveDarts({ playerName }: LoveDartsProps) {
  const submitScore = useSubmitArcadeScore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [dartInRound, setDartInRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [dartResults, setDartResults] = useState<DartResult[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [power, setPower] = useState(0);
  const [aimPos, setAimPos] = useState<{ x: number; y: number } | null>(null);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [comboStreak, setComboStreak] = useState(0);
  const [showPowerMeter, setShowPowerMeter] = useState(false);
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleIdRef = useRef(0);

  const triggerRipple = useCallback((x: number, y: number) => {
    const id = rippleIdRef.current++;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 800);
  }, []);

  const boardRef = useRef<HTMLDivElement>(null);
  const dartIdRef = useRef(0);
  const popupIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const chargeFrameRef = useRef<number>(0);
  const chargeStartRef = useRef(0);
  const pointerDownRef = useRef(false);
  const highScoreRef = useRef(0);
  const roundRef = useRef(round);
  const phaseRef = useRef(phase);
  const totalScoreRef = useRef(totalScore);
  const submittedRef = useRef(false);
  const isGameOverRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { totalScoreRef.current = totalScore; }, [totalScore]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  const isHeartRound = round % 5 === 0;
  const heartRoundBonus = isHeartRound ? 50 : 0;
  const progress = ((round - 1) * DARTS_PER_ROUND + dartInRound) / TOTAL_DARTS;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("love-darts-high");
      if (saved) {
        highScoreRef.current = parseInt(saved, 10) || 0;
      }
    } catch {}
  }, []);

  // Handle phase transitions when dartInRound changes (after a throw completes)
  // This runs AFTER setDartInRound has updated, avoiding React batching issues
  useEffect(() => {
    // Only run when dartInRound actually changed (not on initial mount)
    if (dartInRound === 0 && round === 1) return;
    
    if (dartInRound >= DARTS_PER_ROUND) {
      // All 3 darts in this round have been thrown
      if (round >= ROUNDS) {
        // Game complete - last round's 3rd dart
        if (!isGameOverRef.current) {
          isGameOverRef.current = true;
          setPhase("complete");
          console.log("Game complete via useEffect. Round:", round);
        }
      } else {
        // Transition to next round
        setPhase("round_transition");
        setTimeout(() => {
          setRound((r) => r + 1);
          setDartInRound(0);
          setComboStreak(0);
          setPhase("idle");
        }, 1500);
      }
    } else if (dartInRound > 0 && dartInRound < DARTS_PER_ROUND) {
      // 1st or 2nd dart - return to idle so player can throw again
      setPhase("idle");
    }
  }, [dartInRound, round]);

  // Safety net: detect game completion based on round and darts count
  // (already handled above, but kept as backup for edge cases)
  useEffect(() => {
    if (
      round >= ROUNDS && 
      isGameOverRef.current && 
      phase === "complete" && 
      !submitted
    ) {
      // Already handled by the main flow, but ensure submission
    }
  }, [round, phase]);

  useEffect(() => {
    if (phase === "complete" && !submitted) {
      setSubmitted(true);
      const finalScore = totalScore;
      const isHigh = finalScore > highScoreRef.current && finalScore > 0;
      if (isHigh) {
        highScoreRef.current = finalScore;
        setIsNewHigh(true);
        try {
          localStorage.setItem("love-darts-high", String(finalScore));
        } catch {}
      }
      submitScore.mutate({
        gameType: "LOVE_DARTS",
        score: finalScore,
        playerName,
      });
    }
  }, [phase, submitted, totalScore, submitScore, playerName]);

  useEffect(() => {
    if (phase !== "complete") return;
    setDisplayScore(0);
    const duration = 1200;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * totalScore));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, totalScore]);

  const cancelCharge = useCallback(() => {
    if (chargeFrameRef.current) {
      cancelAnimationFrame(chargeFrameRef.current);
      chargeFrameRef.current = 0;
    }
    setPower(0);
    setShowPowerMeter(false);
  }, []);

  const startCharge = useCallback(() => {
    chargeStartRef.current = performance.now();
    setShowPowerMeter(true);

    const tick = (now: number) => {
      const elapsed = now - chargeStartRef.current;
      const pct = Math.min(elapsed / CHARGE_DURATION_MS, 1);
      setPower(pct);
      if (pct < 1) {
        chargeFrameRef.current = requestAnimationFrame(tick);
      }
    };
    chargeFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const createParticles = useCallback((x: number, y: number, emojis: string[], count: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        baseX: x,
        baseY: y,
        emoji: emojis[i % emojis.length],
        delay: Math.random() * 0.15,
        duration: 0.8 + Math.random() * 0.6,
        offsetX: (Math.random() - 0.5) * 40,
        offsetY: -(Math.random() * 30 + 10),
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1500);
  }, []);

  const addScorePopup = useCallback((x: number, y: number, text: string, color: string) => {
    const id = popupIdRef.current++;
    setScorePopups((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setScorePopups((prev) => prev.filter((p) => p.id !== id));
    }, 1000);
  }, []);

  const executeThrow = useCallback(
    (targetX: number, targetY: number, currentPower: number) => {
      const deviation = (Math.random() - 0.5) * 0.04;
      const halfBoard = BOARD_RADIUS_PCT;
      const distance = Math.sqrt(targetX * targetX + targetY * targetY);
      const distanceRatio = distance / halfBoard;
      const adjustedRatio = Math.max(0, Math.min(1, distanceRatio + deviation));
      const { ring, score: baseScore } = getRing(adjustedRatio);

      const powerMultiplier = 1 + currentPower * 0.5;
      let finalScore = Math.round(baseScore * powerMultiplier);

      const newStreak = baseScore >= 50 ? comboStreak + 1 : 0;
      if (newStreak >= 2) {
        const comboBonus = Math.min(newStreak, 5) * 15;
        finalScore += comboBonus;
      }
      if (baseScore >= 100 && isHeartRound) {
        finalScore += heartRoundBonus;
      }
      setComboStreak(newStreak);

      const dart: DartResult = {
        id: dartIdRef.current++,
        x: targetX,
        y: targetY,
        score: finalScore,
        ring,
        streak: newStreak,
        power: currentPower,
      };

      setPhase("scoring");
      setAimPos(null);
      setShowPowerMeter(false);

      setDartResults((prev) => [...prev, dart]);
      setTotalScore((s) => s + finalScore);

      const popupText = ring === "bullseye"
        ? `+${finalScore} \u2764\uFE0F`
        : ring === "miss"
          ? "+0"
          : `+${finalScore}`;
      addScorePopup(targetX, targetY, popupText, RING_CONFIG[ring].color);

      if (ring === "bullseye" || ring === "inner") {
        createParticles(
          targetX,
          targetY,
          ["\u2764\uFE0F", "\uD83D\uDC9B", "\uD83D\uDC9C", "\u2728", "\u2B50"],
          ring === "bullseye" ? 12 : 6,
        );
        triggerRipple(targetX, targetY);
      }

      const throwDelay = 600;
      setTimeout(() => {
        setDartInRound((prev) => prev + 1);
      }, throwDelay);
    },
    [
      comboStreak, isHeartRound, heartRoundBonus, round,
      addScorePopup, createParticles, triggerRipple,
    ],
  );

  const getPointerPos = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const relX = e.clientX - rect.left - (rect.width - size) / 2;
    const relY = e.clientY - rect.top - (rect.height - size) / 2;
    const svgX = ((relX / size) * 100 - 50) * (BOARD_RADIUS_PCT / 42);
    const svgY = ((relY / size) * 100 - 50) * (BOARD_RADIUS_PCT / 42);
    const clampedX = Math.max(-BOARD_RADIUS_PCT, Math.min(BOARD_RADIUS_PCT, svgX));
    const clampedY = Math.max(-BOARD_RADIUS_PCT, Math.min(BOARD_RADIUS_PCT, svgY));
    return { x: clampedX, y: clampedY };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== "idle") return;
      e.preventDefault();
      const pos = getPointerPos(e);
      if (!pos) return;
      pointerDownRef.current = true;
      setAimPos(pos);
      setPhase("aiming");
      startCharge();
    },
    [phase, getPointerPos, startCharge],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDownRef.current || (phase !== "aiming" && phase !== "throwing")) return;
      const pos = getPointerPos(e);
      if (pos) setAimPos(pos);
    },
    [phase, getPointerPos],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;
      if (phase !== "aiming") return;
      e.preventDefault();
      cancelCharge();
      const pos = aimPos || { x: 0, y: 0 };
      const currentPower = power;
      setPhase("throwing");
      executeThrow(pos.x, pos.y, currentPower);
    },
    [phase, aimPos, power, cancelCharge, executeThrow],
  );

  const resetGame = useCallback(() => {
    cancelCharge();
    pointerDownRef.current = false;
    isGameOverRef.current = false;
    setPhase("idle");
    setRound(1);
    setDartInRound(0);
    setTotalScore(0);
    setDartResults([]);
    setSubmitted(false);
    setPower(0);
    setAimPos(null);
    setScorePopups([]);
    setParticles([]);
    setComboStreak(0);
    setShowPowerMeter(false);
    setIsNewHigh(false);
    setRipples([]);
    dartIdRef.current = 0;
    popupIdRef.current = 0;
    particleIdRef.current = 0;
  }, [cancelCharge]);

  const renderDartboard = () => {
    const rings = [
      { pct: 70, color: "#8FFFE8", stroke: "#8FFFE8", label: "10" },
      { pct: 55, color: "#A0D4E8", stroke: "#A0D4E8", label: "30" },
      { pct: 40, color: "#B8C5FF", stroke: "#B8C5FF", label: "50" },
      { pct: 30, color: "#C9B1FF", stroke: "#C9B1FF", label: "70" },
      { pct: 22, color: "#E8A0D4", stroke: "#E8A0D4", label: "80" },
      { pct: 15, color: "#FF8FB1", stroke: "#FF8FB1", label: "90" },
      { pct: 8, color: "#FF6B9D", stroke: "#FF6B9D", label: "100" },
    ];

    return (
      <svg viewBox="-50 -50 100 100" className="h-full w-full">
        <defs>
          <radialGradient id="boardGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF6B9D" stopOpacity="0.08" />
            <stop offset="60%" stopColor="#E8A0D4" stopOpacity="0.04" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heartGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="0" cy="0" r="50" fill="url(#boardGlow)" />

        {rings.map((ring) => (
          <circle
            key={ring.pct}
            cx="0"
            cy="0"
            r={ring.pct}
            fill={ring.color}
            fillOpacity="0.2"
            stroke={ring.color}
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
        ))}

        {rings.map((ring) => (
          <circle
            key={`ring-${ring.pct}`}
            cx="0"
            cy="0"
            r={ring.pct}
            fill="none"
            stroke={ring.color}
            strokeWidth="0.5"
            strokeOpacity="0.3"
            strokeDasharray="3 3"
          />
        ))}

        <motion.text
          x="0"
          y="0"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="18"
          fontWeight="bold"
          filter="url(#heartGlow)"
          animate={isHeartRound ? {
            scale: [1, 1.18, 1],
          } : {}}
          transition={isHeartRound ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          ❤️
        </motion.text>

        {isHeartRound && (
          <>
            <circle cx="0" cy="0" r="14" fill="none" stroke="#FF6B9D" strokeWidth="0.5" strokeOpacity="0.3">
              <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite" />
              <animate attributeName="strokeOpacity" values="0.3;0.05;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            <text x="0" y="-24" textAnchor="middle" fontSize="4" fill="#FF6B9D" fontWeight="bold" opacity="0.8">
              ❤️ HEART SHOT ❤️
            </text>
          </>
        )}

        <text x="0" y="-14" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">100{isHeartRound ? "+50" : ""}</text>
        <text x="0" y="-21" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">90</text>
        <text x="0" y="-28" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">80</text>
        <text x="0" y="-35" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">70</text>
        <text x="0" y="-42" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">50</text>
        <text x="0" y="-49" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">30</text>
        <text x="0" y="-56" textAnchor="middle" fontSize="3.5" className="fill-slate-400 dark:fill-slate-300" filter="url(#softGlow)">10</text>

        {[...Array(8)].map((_, i) => (
          <line
            key={i}
            x1="0"
            y1="0"
            x2={Math.sin((i * 45 * Math.PI) / 180) * 50}
            y2={-Math.cos((i * 45 * Math.PI) / 180) * 50}
            stroke="#E8A0D4"
            strokeWidth="0.3"
            strokeOpacity="0.1"
            strokeDasharray="2 4"
          />
        ))}
      </svg>
    );
  };

  const renderDartMarkers = () => {
    const placedDarts = dartResults.slice(0, dartResults.length - (phase === "scoring" || phase === "throwing" ? 1 : 0));
    return placedDarts.map((dart) => (
      <motion.div
        key={dart.id}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{
          left: `calc(50% + ${dart.x * (100 / BOARD_RADIUS_PCT) / 2}%)`,
          top: `calc(50% + ${dart.y * (100 / BOARD_RADIUS_PCT) / 2}%)`,
        }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full shadow-lg ring-2 ring-white/80 dark:ring-slate-800/80"
          style={{
            background: RING_CONFIG[dart.ring].color,
            boxShadow: `0 0 10px ${RING_CONFIG[dart.ring].color}80, 0 4px 8px rgba(0,0,0,0.2)`,
          }}
        >
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="white">
            <path d="M6 0C4.5 2 3 3.5 3 5.5C3 7.2 4.3 9 6 12C7.7 9 9 7.2 9 5.5C9 3.5 7.5 2 6 0Z" />
          </svg>
        </div>
      </motion.div>
    ));
  };

  const renderFlyingDart = () => {
    if (phase !== "throwing") return null;
    const lastResult = dartResults[dartResults.length - 1];
    if (!lastResult) return null;

    const startY = 68;
    const targetY = lastResult.y;
    const targetX = lastResult.x;
    const midX = targetX * 0.5;
    const midY = (startY + targetY) / 2 - 12;

    return (
      <>
        <svg
          viewBox="-50 -50 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 17 }}
        >
          <defs>
            <linearGradient id="trailFade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF6B9D" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#E8A0D4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C9B1FF" stopOpacity="0" />
            </linearGradient>
            <filter id="trailBlur">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          <motion.path
            d={`M0,${startY} Q${midX},${midY} ${targetX},${targetY}`}
            fill="none"
            stroke="url(#trailFade)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#trailBlur)"
            initial={{ pathLength: 0, opacity: 0.7 }}
            animate={{ pathLength: 1, opacity: 0.2 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d={`M0,${startY} Q${midX},${midY} ${targetX},${targetY}`}
            fill="none"
            stroke="#FF6B9D"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="4 6"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>

        <motion.div
          key={`dart-flight-${lastResult.id}`}
          className="absolute z-20 pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            perspective: "500px",
          }}
          initial={{
            x: 0,
            y: startY,
            rotate: 40,
            opacity: 0,
            scale: 0.15,
          }}
          animate={{
            x: targetX,
            y: targetY,
            rotate: [40, 15, 5],
            opacity: [0, 1, 1, 1],
            scale: [0.15, 1.4, 1.15, 1],
            rotateX: [0, -30, -10],
            rotateY: [30, 0, -5],
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            style={{ transformStyle: "preserve-3d" }}
            animate={
              phase === "throwing"
                ? { scale: [1, 1.15, 0.95, 1] }
                : {}
            }
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
              className="drop-shadow-xl"
              style={{ filter: "drop-shadow(0 0 12px rgba(255,107,157,0.6))" }}
            >
              <line x1="4" y1="20" x2="28" y2="20" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
              <polygon points="28,12 38,20 28,28" fill="#FF6B9D" />
              <line x1="7" y1="13" x2="7" y2="27" stroke="#A0AEC0" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="14" cy="20" r="2.5" fill="#FF6B9D40" stroke="#FF6B9D" strokeWidth="0.5" />
            </svg>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute z-19 pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            perspective: "500px",
          }}
          initial={{
            x: 0,
            y: startY,
            rotate: 40,
            scale: 0.2,
            opacity: 0.35,
          }}
          animate={{
            x: targetX,
            y: targetY,
            rotate: 6,
            scale: 0.5,
            opacity: 0,
            rotateX: [0, -15],
            rotateY: [15, 0],
          }}
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
            delay: -0.07,
          }}
        >
          <div style={{ transformStyle: "preserve-3d" }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <line x1="4" y1="20" x2="28" y2="20" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              <polygon points="28,12 38,20 28,28" fill="#FF6B9D" opacity="0.35" />
            </svg>
          </div>
        </motion.div>
      </>
    );
  };

  const renderAimTrajectory = () => {
    if (phase !== "aiming" || !aimPos) return null;
    const sx = 0, sy = 46;
    const ex = aimPos.x, ey = aimPos.y;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 14;
    const angle = Math.atan2(ex - sx, sy - ey) * (180 / Math.PI);
    const distance = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
    const dartScale = Math.min(1.1, 0.5 + distance / 70);

    return (
      <>
        <svg
          viewBox="-50 -50 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 12 }}
        >
          <path
            d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
            fill="none"
            stroke="#FF6B9D"
            strokeWidth="1"
            strokeDasharray="3 4"
            strokeOpacity="0.35"
          />
          <circle cx={ex} cy={ey} r="1.5" fill="#FF6B9D" fillOpacity="0.6">
            <animate attributeName="r" values="1.5;2.5;1.5" dur="1s" repeatCount="indefinite" />
            <animate attributeName="fillOpacity" values="0.6;0.15;0.6" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        <motion.div
          className="absolute z-15 pointer-events-none"
          style={{
            left: `calc(50% + 0%)`,
            top: `calc(50% + ${sy * (100 / BOARD_RADIUS_PCT) / 2}%)`,
          }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: dartScale }}
          transition={{ duration: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        >
          <motion.div
            animate={{ rotate: angle }}
            transition={{ duration: 0.1, ease: "linear" }}
          >
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none"
              className="drop-shadow-lg"
              style={{ filter: "drop-shadow(0 0 6px rgba(255,107,157,0.5))" }}
            >
              <line x1="4" y1="20" x2="28" y2="20" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
              <polygon points="28,12 38,20 28,28" fill="#FF6B9D" />
              <line x1="7" y1="13" x2="7" y2="27" stroke="#A0AEC0" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        </motion.div>
      </>
    );
  };

  const renderAimReticle = () => {
    if (phase !== "aiming" || !aimPos) return null;
    return (
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        style={{
          left: `calc(50% + ${aimPos.x * (100 / BOARD_RADIUS_PCT) / 2}%)`,
          top: `calc(50% + ${aimPos.y * (100 / BOARD_RADIUS_PCT) / 2}%)`,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15, type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute rounded-full border-2"
            style={{ borderColor: "#FF6B9D" }}
            animate={{
              width: [32, 48, 32],
              height: [32, 48, 32],
              opacity: [0.8, 0.3, 0.8],
              boxShadow: [
                "0 0 8px rgba(255,107,157,0.4)",
                "0 0 20px rgba(255,107,157,0.15)",
                "0 0 8px rgba(255,107,157,0.4)",
              ],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div
            className="absolute w-10 h-10 rounded-full border-2"
            style={{ borderColor: "#FF6B9D", boxShadow: "0 0 16px rgba(255,107,157,0.3)" }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#FF6B9D", boxShadow: "0 0 8px #FF6B9D" }}
          />
          <svg className="absolute w-6 h-6 text-pink-400 opacity-50" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            <line x1="8" y1="0" x2="8" y2="3" stroke="currentColor" strokeWidth="0.5" />
            <line x1="8" y1="13" x2="8" y2="16" stroke="currentColor" strokeWidth="0.5" />
            <line x1="0" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="0.5" />
            <line x1="13" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
      </motion.div>
    );
  };

  const renderScorePopups = () => {
    const emojiMap: Record<Ring, string> = {
      bullseye: "\uD83D\uDCA5",
      inner: "\u2728",
      middle: "\uD83C\uDF1F",
      outer: "\uD83D\uDC9B",
      mid: "\uD83D\uDC9C",
      inner2: "\uD83D\uDC9D",
      outer2: "\uD83E\uDD7A",
      miss: "\uD83D\uDCA8",
    };

    return (
      <AnimatePresence>
        {scorePopups.map((popup) => (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: 0, scale: 0.3 }}
            animate={{ opacity: 1, y: -50, scale: 1.4 }}
            exit={{ opacity: 0, y: -80, scale: 0.6 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute -translate-x-1/2 z-30 pointer-events-none font-heading font-bold whitespace-nowrap drop-shadow-xl"
            style={{
              left: `calc(50% + ${popup.x * (100 / BOARD_RADIUS_PCT) / 2}%)`,
              top: `calc(50% + ${popup.y * (100 / BOARD_RADIUS_PCT) / 2}%)`,
              color: popup.color,
              fontSize: popup.text.includes("❤️") ? "1.25rem" : "1rem",
              textShadow: `0 0 12px ${popup.color}90, 0 2px 8px rgba(0,0,0,0.2)`,
            }}
          >
            {popup.text}
          </motion.div>
        ))}
      </AnimatePresence>
    );
  };

  const renderParticles = () => {
    if (particles.length === 0) return null;
    return (
      <AnimatePresence>
        {particles.map((p) => {
          const left = `calc(50% + ${p.baseX * (100 / BOARD_RADIUS_PCT) / 2}%)`;
          const top = `calc(50% + ${p.baseY * (100 / BOARD_RADIUS_PCT) / 2}%)`;
          return (
            <div
              key={p.id}
              className="absolute z-25 pointer-events-none"
              style={{ left, top }}
            >
              <motion.span
                initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
                animate={{
                  opacity: 0,
                  x: p.offsetX,
                  y: p.offsetY,
                  scale: [1.5, 0],
                  rotate: 360,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                className="block text-sm"
              >
                {p.emoji}
              </motion.span>
            </div>
          );
        })}
      </AnimatePresence>
    );
  };

  const renderRipples = () => {
    if (ripples.length === 0) return null;
    return (
      <AnimatePresence>
        {ripples.map((r) => (
          <div
            key={r.id}
            className="absolute z-5 pointer-events-none"
            style={{
              left: `calc(50% + ${r.x * (100 / BOARD_RADIUS_PCT) / 2}%)`,
              top: `calc(50% + ${r.y * (100 / BOARD_RADIUS_PCT) / 2}%)`,
            }}
          >
            <motion.div
              initial={{ width: 0, height: 0, opacity: 0.6 }}
              animate={{ width: 40, height: 40, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{ border: "2px solid #FF6B9D", boxShadow: "0 0 12px rgba(255,107,157,0.3)" }}
            />
          </div>
        ))}
      </AnimatePresence>
    );
  };

  const renderPowerMeter = () => {
    if (!showPowerMeter) return null;
    const pct = Math.round(power * 100);
    const barColor = power < 0.3 ? "#FF8FB1" : power < 0.7 ? "#FF6B9D" : "#E8A0D4";
    const isSweetSpot = power > 0.6 && power < 0.85;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-3.5 rounded-full overflow-hidden bg-pink-100 dark:bg-pink-950/40 relative">
            <motion.div
              className="h-full rounded-full relative"
              style={{
                background: `linear-gradient(90deg, #FF8FB1, ${barColor}, #C9B1FF)`,
                boxShadow: isSweetSpot ? "0 0 12px rgba(255,215,0,0.4)" : "none",
              }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.05, ease: "linear" }}
            >
              {isSweetSpot && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(255,215,0,0.15)" }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
            </motion.div>
            {isSweetSpot && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: "68%" }}
                initial={{ scale: 0 }}
                animate={{
                  scale: [1, 1.4, 1],
                  filter: [
                    "drop-shadow(0 0 4px rgba(255,215,0,0.6))",
                    "drop-shadow(0 0 10px rgba(255,215,0,0.8))",
                    "drop-shadow(0 0 4px rgba(255,215,0,0.6))",
                  ],
                }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              </motion.div>
            )}
          </div>
          <motion.span
            className="font-heading text-base font-bold min-w-[3rem] text-right"
            style={{ color: barColor }}
            animate={{ scale: pct === 100 ? [1, 1.15, 1] : isSweetSpot ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 0.3, repeat: pct === 100 || isSweetSpot ? Infinity : 0, repeatDelay: 0.5 }}
          >
            {pct}%
          </motion.span>
        </div>
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[11px] text-muted-foreground/60">Weak</span>
          <motion.span
            className="text-[11px] font-bold tracking-wider"
            style={{
              color: isSweetSpot ? "#FFD700" : "transparent",
              textShadow: isSweetSpot ? "0 0 8px rgba(255,215,0,0.5)" : "none",
            }}
            animate={{ opacity: isSweetSpot ? [0.4, 1, 0.4] : 0 }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ✨ SWEET SPOT ✨
          </motion.span>
          <span className="text-[11px] text-muted-foreground/60">Max</span>
        </div>
      </motion.div>
    );
  };

  const renderComboIndicator = () => {
    if ((phase !== "idle" && phase !== "aiming") || comboStreak < 2) return null;
    const multiplier = Math.min(comboStreak, 5);
    const colors = ["", "#FF8FB1", "#FF6B9D", "#E8A0D4", "#C9B1FF", "#FFD700"];
    const fireEmojis = ["", "\uD83D\uDD25", "\uD83D\uDD25\uD83D\uDD25", "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25", "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25"];

    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${colors[multiplier]}20, ${colors[Math.max(1, multiplier - 1)]}15)`,
          border: `1.5px solid ${colors[multiplier]}50`,
        }}
      >
        <motion.span
          className="text-sm"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        >
          {fireEmojis[Math.min(multiplier, 4)]}
        </motion.span>
        <Zap className="w-4 h-4" style={{ color: colors[multiplier] }} />
        <motion.span
          className="font-heading text-sm font-bold"
          style={{ color: colors[multiplier] }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        >
          {multiplier}x Combo
        </motion.span>
      </motion.div>
    );
  };

  const renderRoundTransition = () => {
    if (phase !== "round_transition") return null;
    const nextRound = round + 1;
    const isSpecialRound = nextRound % 5 === 0;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(255, 107, 157, 0.1)", backdropFilter: "blur(10px)" }}
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="mb-6"
          >
            <div className="flex justify-center gap-3">
              {[...Array(3)].map((_, i) => (
                <motion.span
                  key={i}
                  className="text-3xl"
                  animate={{
                    y: [0, -14, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.12,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                >
                  ❤️
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <motion.p
              className="font-heading text-4xl font-bold text-pink-500"
              key={`round-${nextRound}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
            >
              Round {nextRound}
            </motion.p>
          </motion.div>

          {isSpecialRound && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="mt-3"
            >
              <span className="inline-block px-4 py-1.5 rounded-full font-heading text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(255,107,157,0.2), rgba(232,160,212,0.2))",
                  color: "#FF6B9D",
                  border: "1px solid rgba(255,107,157,0.3)",
                }}
              >
                ❤️ Heart Shot Round! ❤️
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <motion.p
              className="text-base text-muted-foreground"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Siap?
            </motion.p>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const renderGameOverConfetti = () => {
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => {
          const emoji = CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length];
          const left = Math.random() * 100;
          const delay = Math.random() * 2;
          const duration = 2 + Math.random() * 3;
          const size = 12 + Math.random() * 16;
          return (
            <motion.div
              key={i}
              className="absolute top-0"
              style={{ left: `${left}%`, fontSize: `${size}px` }}
              initial={{ y: -40, opacity: 1, rotate: 0 }}
              animate={{
                y: "100vh",
                opacity: [1, 1, 0],
                rotate: 360 + Math.random() * 360,
                x: (Math.random() - 0.5) * 200,
              }}
              transition={{ duration, delay, ease: "easeIn", repeat: Infinity, repeatDelay: 0.5 }}
            >
              {emoji}
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderGameOver = () => {
    const rating = getRating(totalScore);
    const avgPoints = Math.round(totalScore / TOTAL_DARTS);

    return (
      <div className="mx-auto max-w-lg text-center relative">
        {renderGameOverConfetti()}

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="mb-6 flex justify-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full relative"
            style={{ background: "linear-gradient(135deg, #FF6B9D20, #E8A0D420)" }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Trophy className="h-12 w-12 text-yellow-400" />
            </motion.div>
            {isNewHigh && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -top-1 -right-1"
              >
                <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-heading text-3xl font-semibold mb-1">
            Game Over! 🎯
          </h2>
          <motion.p
            className={`font-heading text-xl ${rating.color}`}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {rating.emoji} {rating.label}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <motion.div
            className="inline-flex items-center gap-4 rounded-2xl px-8 py-5"
            style={{
              border: "2px solid #FF6B9D30",
              background: "linear-gradient(135deg, #FF6B9D08, #E8A0D408)",
            }}
            whileHover={{ scale: 1.02 }}
          >
            <Trophy className="h-7 w-7" style={{ color: "#FF6B9D" }} />
            <div>
              <motion.p
                className="text-5xl font-bold font-heading"
                style={{ color: "#FF6B9D" }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {displayScore}
              </motion.p>
              <p className="text-xs text-muted-foreground">Total Skor</p>
            </div>
          </motion.div>

          {isNewHigh && (
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              className="mt-3 text-sm font-semibold"
              style={{ color: "#FFD700" }}
            >
              🏆 Skor Tertinggi Baru!
            </motion.p>
          )}

          <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
            <span>Rata-rata: {avgPoints} point/dart</span>
            <span>·</span>
            <span>Best: {dartResults.reduce((max, d) => Math.max(max, d.score), 0)} point</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8"
        >
          <Button onClick={resetGame} className="gap-2" size="lg">
            <RotateCcw className="h-4 w-4" />
            Main Lagi
          </Button>
        </motion.div>
      </div>
    );
  };

   if (phase === "complete") {
     console.log("Rendering Game Over screen, phase:", phase);
     return renderGameOver();
   }

  const boardHint = phase === "idle"
    ? "Tekan dan tahan papan untuk membidik"
    : phase === "aiming"
      ? "Gerakkan untuk membidik, lepas untuk melempar!"
      : phase === "throwing"
        ? ""
        : "";

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 relative">

      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "linear-gradient(135deg, #FF6B9D15, #E8A0D415)" }}
          >
            <Target className="h-3.5 w-3.5" style={{ color: "#FF6B9D" }} />
            <span className="text-xs font-medium">
              <span className="font-heading font-bold" style={{ color: "#FF6B9D" }}>{round}</span>
              <span className="text-muted-foreground">/{ROUNDS}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
            {[...Array(DARTS_PER_ROUND)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-4 rounded-sm"
                style={{
                  background: i < dartInRound ? "#FF6B9D" : "#E2E8F0",
                  opacity: i < dartInRound ? 1 : 0.3,
                }}
                animate={i === dartInRound && phase === "idle" ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "#FF6B9D10" }}
          >
            <Heart className="h-3.5 w-3.5 fill-[#FF6B9D] text-[#FF6B9D]" />
            <motion.span
              className="font-heading text-sm font-bold"
              style={{ color: "#FF6B9D" }}
              key={totalScore}
              initial={{ scale: 1.3, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {totalScore}
            </motion.span>
          </div>
        </div>
      </div>

      <div className="w-full h-1.5 rounded-full overflow-hidden bg-pink-100 dark:bg-pink-950/30">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #FF8FB1, #FF6B9D, #E8A0D4, #C9B1FF)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {renderPowerMeter()}

      <div
        ref={boardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (pointerDownRef.current) {
            pointerDownRef.current = false;
            if (phase === "aiming") {
              cancelCharge();
              setPhase("idle");
              setAimPos(null);
            }
          }
        }}
        className="relative aspect-square w-full max-w-sm cursor-crosshair select-none"
        style={{
          touchAction: "none",
          perspective: "600px",
        }}
      >
        <motion.div
          className="absolute -inset-0.5 rounded-3xl pointer-events-none"
          style={{
            background: phase === "aiming" || phase === "throwing"
              ? "linear-gradient(135deg, rgba(255,107,157,0.25), rgba(232,160,212,0.15))"
              : "transparent",
            filter: "blur(4px)",
          }}
          animate={phase === "aiming" ? {
            opacity: [0.4, 0.8, 0.4],
          } : phase === "throwing" ? {
            opacity: [0.8, 0.2, 0],
          } : {}}
          transition={phase === "aiming" ? {
            duration: 1.2, repeat: Infinity, ease: "easeInOut",
          } : { duration: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 rounded-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,107,157,0.06), rgba(232,160,212,0.06))",
            backdropFilter: "blur(2px)",
            boxShadow: phase === "aiming"
              ? "0 8px 40px rgba(255,107,157,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
              : "0 8px 32px rgba(255,107,157,0.08), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
          animate={phase === "aiming" ? {
            boxShadow: [
              "0 8px 40px rgba(255,107,157,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
              "0 8px 48px rgba(255,107,157,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
              "0 8px 40px rgba(255,107,157,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
            ],
          } : {}}
          transition={phase === "aiming" ? {
            duration: 1.5, repeat: Infinity, ease: "easeInOut",
          } : { duration: 0.3 }}
        />

        <motion.div
          className="relative w-full h-full"
          animate={{ rotateX: phase === "aiming" ? 2 : 0, rotateY: phase === "aiming" ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="p-3">
            <div className="relative w-full h-full">
              {renderDartboard()}
              {renderRipples()}
              {renderDartMarkers()}
              {renderFlyingDart()}
              {renderAimTrajectory()}
              {renderAimReticle()}
              {renderScorePopups()}
              {renderParticles()}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-3 min-h-[2rem]">
        {renderComboIndicator()}

        <p className="text-xs text-muted-foreground">
          {boardHint || (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              Klik dan tahan untuk membidik
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
