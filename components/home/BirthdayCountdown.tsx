"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { motion, useInView, useAnimate } from "framer-motion";
import { useCountdown } from "@/hooks/useCountdown";
import { useClockTick } from "@/hooks/useClockTick";
import {
  getNextBirthday,
  getAge,
  getDaysUntilNextBirthday,
  isSameMonthDayJakarta,
} from "@/lib/date";
import { Cake, PartyPopper, Sparkles } from "lucide-react";
import { DEFAULT_NAME1 } from "@/lib/couple-display";

type BirthdayCountdownProps = {
  birthDate: string | Date | null;
  name?: string | null;
};

function AnimatedNumber({ value, label }: { value: number; label: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevRef = useRef(value);
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (prevRef.current !== value) {
      const start = prevRef.current;
      const end = value;
      const duration = 300;
      const startTime = performance.now();

      function tick(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        setDisplayValue(current);
        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      animate(
        scope.current,
        { scale: [1.15, 1], opacity: [0.7, 1] },
        { duration: 0.3, ease: "easeOut" },
      );
      prevRef.current = value;
    }
  }, [value, animate, scope]);

  return (
    <div className="flex flex-col items-center">
      <span
        ref={scope}
        suppressHydrationWarning
        className="font-heading text-2xl font-bold tabular-nums text-primary sm:text-4xl md:text-5xl"
      >
        {displayValue.toLocaleString("id-ID")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function BirthdayCountdown({
  birthDate,
  name,
}: BirthdayCountdownProps) {
  const displayName = name?.trim() || DEFAULT_NAME1;
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  // One Date instance per clock tick: stable within a render pass (so
  // useCountdown's effect can't loop) but refreshed every second, which keeps
  // "Besok"/age/celebration correct if the page stays open across midnight.
  const { tick } = useClockTick();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` is the 1 Hz trigger for a fresh Date
  const now = useMemo(() => new Date(), [tick]);
  const nextBirthday = useMemo(
    () => (birthDate ? getNextBirthday(birthDate, now) : null),
    [birthDate, now],
  );
  const age = useMemo(
    () => (birthDate ? getAge(birthDate, now) : 0),
    [birthDate, now],
  );
  const daysUntil = useMemo(
    () => (birthDate ? getDaysUntilNextBirthday(birthDate, now) : 0),
    [birthDate, now],
  );
  const isBirthdayToday = useMemo(
    () => (birthDate ? isSameMonthDayJakarta(birthDate, now) : false),
    [birthDate, now],
  );

  const { days, hours, minutes, seconds } = useCountdown(nextBirthday);

  if (!birthDate || !nextBirthday) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <div className="mb-3 flex items-center justify-center gap-2">
        {isBirthdayToday ? (
          <PartyPopper className="h-5 w-5 text-primary" />
        ) : (
          <Cake className="h-4 w-4 text-primary" />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {isBirthdayToday ? "Selamat Ulang Tahun!" : `Ulang Tahun ${displayName}`}
        </span>
        {isBirthdayToday ? (
          <PartyPopper className="h-5 w-5 text-primary" />
        ) : (
          <Cake className="h-4 w-4 text-primary" />
        )}
      </div>

      {isBirthdayToday ? (
        <div className="py-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
          </motion.div>
          <p className="mt-2 font-heading text-xl font-bold text-primary sm:text-2xl break-words">
            Selamat Ulang Tahun {displayName}!
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Usia: {age} tahun
          </p>
        </div>
      ) : (
        <>
          <p className="mb-1 font-heading text-xl">
            {daysUntil === 0
              ? "Hari ini!"
              : daysUntil === 1
                ? "Besok!"
                : `${daysUntil.toLocaleString("id-ID")} hari lagi`}
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            Menuju ulang tahun {displayName} (usia ke-{age + 1} tahun)
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AnimatedNumber value={days} label="Hari" />
            <AnimatedNumber value={hours} label="Jam" />
            <AnimatedNumber value={minutes} label="Menit" />
            <AnimatedNumber value={seconds} label="Detik" />
          </div>
        </>
      )}
    </motion.div>
  );
}
