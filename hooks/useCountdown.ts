"use client";

import { useState, useEffect, useMemo } from "react";
import { getJakartaParts } from "@/lib/date";
import { useClockTick } from "./useClockTick";

type CountdownData = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  totalDays: number;
};

function computeCountdown(now: Date, target: Date | null): CountdownData {
  if (!target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, totalDays: 0 };
  }

  const diffMs = now.getTime() - target.getTime();
  const isPast = diffMs >= 0;
  const absDiffMs = Math.abs(diffMs);

  const totalDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
  const days = totalDays;
  const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isPast, totalDays: isPast ? totalDays : 0 };
}

function toJakartaMidnightInput(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  if (isNaN(d.getTime())) return d;
  const parts = getJakartaParts(d);
  if (!parts) return d;
  return new Date(
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T00:00:00+07:00`,
  );
}

export function useCountdown(targetDate: Date | string | null): CountdownData {
  // Derive (don't stash in a ref during render): memo keeps the same Date
  // instance while the input is unchanged.
  const target = useMemo(
    () => (targetDate ? toJakartaMidnightInput(targetDate) : null),
    [targetDate],
  );

  const { now } = useClockTick();

  // Deterministic first render: `new Date()` on the server and at hydration
  // time differ by seconds, which is a hydration mismatch (React #418) on every
  // page with a countdown. Zeros are rendered identically on both sides and the
  // effect fills in the real value immediately after hydration.
  const [data, setData] = useState<CountdownData | null>(null);

  useEffect(() => {
    setData(computeCountdown(now, target));
  }, [now, target]);

  return data ?? { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, totalDays: 0 };
}
