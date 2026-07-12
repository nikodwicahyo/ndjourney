"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { motion, useInView, useAnimate } from "framer-motion";
import { useCountdown } from "@/hooks/useCountdown";
import { isSameMonthDayJakarta, getYearsSince, getElapsedSince } from "@/lib/date";
import { Heart, Sparkles } from "lucide-react";

type CountdownTimerProps = {
  anniversaryDate: string | Date;
  name1?: string;
  name2?: string;
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

export default function CountdownTimer({
  anniversaryDate,
  name1,
  name2,
}: CountdownTimerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const yearsSince = useMemo(
    () => getYearsSince(anniversaryDate),
    [anniversaryDate],
  );
  const elapsed = useMemo(
    () => getElapsedSince(anniversaryDate),
    [anniversaryDate],
  );
  const isAnniversaryToday = useMemo(
    () => isSameMonthDayJakarta(anniversaryDate, new Date()),
    [anniversaryDate],
  );

  const { days, hours, minutes, seconds } = useCountdown(anniversaryDate);

  if (!anniversaryDate) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <div className="mb-3 flex items-center justify-center gap-2">
        <Heart className="h-4 w-4 fill-primary text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          {name1 && name2 ? `${name1} & ${name2}` : "Bersama"}
        </span>
        <Heart className="h-4 w-4 fill-primary text-primary" />
      </div>

      {isAnniversaryToday ? (
        <div className="py-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
          </motion.div>
          <p className="mt-2 font-heading text-2xl font-bold text-primary">
            🎉 Selamat Anniversary ke-{yearsSince} tahun! 🎉
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 mt-1 font-heading text-xl font-semibold">
            Hari ke-{days.toLocaleString("id-ID")} bersama
          </p>
          <p className="text-sm text-muted-foreground">
            {elapsed.years} tahun {elapsed.months} bulan {elapsed.days} hari
          </p>

          <div className="grid grid-cols-4 gap-2">
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
