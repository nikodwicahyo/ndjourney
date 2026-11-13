"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Quote } from "lucide-react";
import { getQuoteOfTheDay, msUntilNextQuotePeriod } from "@/lib/quotes";

export default function QuoteOfTheDay() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [quote, setQuote] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    // Pure function of the current WIB period: re-running it is always safe, and
    // React bails out when the text is unchanged.
    function sync() {
      if (active) setQuote(getQuoteOfTheDay());
    }

    function schedule() {
      if (!active) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        sync();
        schedule();
      }, msUntilNextQuotePeriod());
    }

    // Background tabs throttle timers and devices sleep mid-period, so re-check
    // and re-arm whenever the page wakes up rather than trusting one long timer.
    function resync() {
      sync();
      schedule();
    }

    sync();
    schedule();
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);

    return () => {
      active = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
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
