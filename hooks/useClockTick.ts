"use client";

import { useState, useEffect } from "react";

const listeners = new Set<() => void>();
let sharedNow: Date = new Date();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tickClock() {
  sharedNow = new Date();
  listeners.forEach((fn) => fn());
}

function startSharedClock() {
  if (intervalId) return;
  intervalId = setInterval(tickClock, 1000);
}

function stopSharedClock() {
  if (listeners.size === 0 && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useClockTick(): { tick: number; now: Date } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    startSharedClock();
    return () => {
      listeners.delete(listener);
      stopSharedClock();
    };
  }, []);

  return { tick, now: sharedNow };
}
