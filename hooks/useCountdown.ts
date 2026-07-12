"use client";

import { useState, useEffect, useRef } from "react";
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
  const targetRef = useRef<Date | null>(null);

  if (targetDate) {
    targetRef.current = toJakartaMidnightInput(targetDate);
  } else {
    targetRef.current = null;
  }

  const { now } = useClockTick();

  const [data, setData] = useState<CountdownData>(() =>
    computeCountdown(new Date(), targetRef.current),
  );

  useEffect(() => {
    setData(computeCountdown(now, targetRef.current));
  }, [now]);

  return data;
}
