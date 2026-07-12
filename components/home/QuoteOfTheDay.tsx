"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Quote } from "lucide-react";
import { getQuoteOfTheDay } from "@/lib/quotes";
import { getJakartaParts } from "@/lib/date";

export default function QuoteOfTheDay() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [quote, setQuote] = useState<string>("");

  useEffect(() => {
    function update() {
      setQuote(getQuoteOfTheDay());
    }

    update();

    const msUntilNext = getMsUntilNextPeriod();
    const timeout = setTimeout(() => {
      update();
    }, msUntilNext);

    const interval = setInterval(update, 6 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className=""
    >
      <div className="relative rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Quote className="absolute top-4 left-4 h-8 w-8 text-primary/20" />
        <p className="font-heading text-lg italic leading-relaxed text-foreground md:text-xl">
          &ldquo;{quote}&rdquo;
        </p>
        <p className="mt-4 text-xs text-muted-foreground">Quote of the Day</p>
      </div>
    </motion.div>
  );
}

function getMsUntilNextPeriod(): number {
  const now = new Date();
  const parts = getJakartaParts(now);
  if (!parts) return 6 * 60 * 60 * 1000;

  const { year, month, day, hour } = parts;
  const period = Math.floor(hour / 6);
  const nextBoundaryHour = (period + 1) * 6;

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
  return ms > 0 ? ms : 6 * 60 * 60 * 1000;
}
