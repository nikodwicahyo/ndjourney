"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Quote } from "lucide-react";
import { getQuoteOfTheDay, QUOTES, loadShownQuoteIndices, saveShownQuoteIndex, resetShownQuotes } from "@/lib/quotes";
import { getJakartaParts } from "@/lib/date";

export default function QuoteOfTheDay() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [quote, setQuote] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gate dynamic content on mount so server HTML and first client render match
  // (the quote depends on localStorage/random, which differ).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function update() {
      const shown = loadShownQuoteIndices();
      const q = getQuoteOfTheDay(shown);
      setQuote(q);
      const idx = QUOTES.indexOf(q);
      if (idx !== -1) saveShownQuoteIndex(idx);
    }

    function scheduleNext() {
      const ms = getMsUntilNextPeriod();
      timeoutRef.current = setTimeout(() => {
        update();
        scheduleNext();
      }, ms);
    }

    update();
    scheduleNext();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="relative rounded-2xl border border-border bg-card p-6 text-center shadow-sm overflow-hidden">
        <Quote className="absolute top-4 left-4 h-8 w-8 text-primary/20" />
        <p className="font-heading text-base italic leading-relaxed text-foreground sm:text-lg md:text-xl break-words">
          &ldquo;{quote}&rdquo;
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <p className="text-xs text-muted-foreground">Quote of the Day</p>
        </div>
      </div>
    </motion.div>
  );
}

function getMsUntilNextPeriod(): number {
  const now = new Date();
  const parts = getJakartaParts(now);
  if (!parts) return 4 * 60 * 60 * 1000;

  const { year, month, day, hour } = parts;
  const nextBoundaryHour = (Math.floor(hour / 4) + 1) * 4;

  let boundaryYear = year;
  let boundaryMonth = month;
  let boundaryDay = day;
  let boundaryHour: number;

  if (nextBoundaryHour === 24) {
    const nextDate = new Date(year, month - 1, day + 1);
    boundaryYear = nextDate.getFullYear();
    boundaryMonth = nextDate.getMonth() + 1;
    boundaryDay = nextDate.getDate();
    boundaryHour = 0;
  } else {
    boundaryHour = nextBoundaryHour;
  }

  const boundary = Date.UTC(boundaryYear, boundaryMonth - 1, boundaryDay, boundaryHour - 7, 0, 0, 0);
  const ms = boundary - now.getTime();
  return ms > 0 ? ms : 4 * 60 * 60 * 1000;
}
