"use client";

import { useEffect, useState } from "react";
import { getJakartaToday, msUntilNextJakartaMidnight } from "@/lib/date";

/**
 * The current Asia/Jakarta calendar day (`YYYY-MM-DD`), re-rendering exactly
 * when the day flips at Jakarta midnight (00:00 WIB) and resyncing when the
 * tab becomes visible again (laptop slept through midnight).
 */
export function useJakartaToday(): string {
  const [today, setToday] = useState(getJakartaToday);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      // +1s so the timer never lands a hair before midnight.
      timer = setTimeout(() => {
        setToday(getJakartaToday());
        schedule();
      }, msUntilNextJakartaMidnight() + 1_000);
    }

    function resync() {
      if (document.visibilityState !== "visible") return;
      setToday(getJakartaToday());
      clearTimeout(timer);
      schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", resync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  return today;
}
