const TIMEZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getJakartaParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  if (!date || isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const result: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") result[p.type] = parseInt(p.value, 10);
  }

  if (
    result.year === undefined || result.month === undefined ||
    result.day === undefined || result.hour === undefined ||
    result.minute === undefined || result.second === undefined
  ) return null;

  return result as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

// Real current instant — use new Date() instead of synthetic Jakarta-shifted Dates
// All helpers below either format, extract calendar parts, or convert Jakarta inputs
// to real UTC instants for persistence.

export function formatInJakarta(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // toLocaleString (not toLocaleDateString) so time-only options actually
  // render the clock in every engine.
  return d.toLocaleString("id-ID", {
    timeZone: TIMEZONE,
    ...options,
  });
}

/**
 * Jakarta wall-clock time as `HH:mm`. One canonical format for the whole app —
 * `toLocaleString("id-ID")` renders `00.00`, which we never want.
 */
export function formatJakartaTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = getJakartaParts(d);
  if (!parts) return "";
  // Some engines report midnight as hour 24 under hour12:false.
  const hour = parts.hour % 24;
  return `${String(hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/**
 * Human countdown with hour + minute precision: "2 hari 5 jam 12 menit lagi".
 * Seconds are deliberately omitted — the caller re-renders every minute.
 */
export function formatCountdownRemaining(ms: number): string {
  const totalMinutes = Math.floor(Math.max(ms, 0) / 60_000);
  if (totalMinutes < 1) return "kurang dari 1 menit lagi";

  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hari`);
  if (days > 0 || hours > 0) parts.push(`${hours} jam`);
  parts.push(`${minutes} menit`);
  return `${parts.join(" ")} lagi`;
}

export function parseJakartaDateOnly(dateStr: string): Date | null {
  if (!DATE_ONLY_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const verify = new Date(utcMidnight);
  if (
    verify.getUTCFullYear() !== y ||
    verify.getUTCMonth() + 1 !== m ||
    verify.getUTCDate() !== d
  ) return null;
  return new Date(utcMidnight - JAKARTA_OFFSET_MS);
}

export function parseJakartaDateTime(dateStr: string, timeStr: string): Date | null {
  if (!DATE_ONLY_RE.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0) - JAKARTA_OFFSET_MS);
}

export function jakartaYearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

export function jakartaYearEnd(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - JAKARTA_OFFSET_MS);
}

export function getNextBirthday(
  birthDate: Date | string | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const bdParts = getJakartaParts(d);
  const todayParts = getJakartaParts(now);
  if (!bdParts || !todayParts) return null;

  const thisYear = todayParts.year;

  const thisBirthday = new Date(`${thisYear}-${String(bdParts.month).padStart(2, "0")}-${String(bdParts.day).padStart(2, "0")}T00:00:00+07:00`);
  if (isNaN(thisBirthday.getTime())) return null;

  if (thisBirthday >= now) {
    return thisBirthday;
  }

  const next = new Date(`${thisYear + 1}-${String(bdParts.month).padStart(2, "0")}-${String(bdParts.day).padStart(2, "0")}T00:00:00+07:00`);
  return isNaN(next.getTime()) ? null : next;
}

/**
 * Whole calendar days between two instants in Asia/Jakarta (target - from).
 * Compares date parts, not elapsed 24h blocks, so 6 hours left on the eve of a
 * date still counts as "1 day" (tomorrow), never "0" (today).
 */
export function getJakartaDayDiff(
  target: Date | string,
  from: Date | string = new Date(),
): number | null {
  const t = typeof target === "string" ? new Date(target) : target;
  const f = typeof from === "string" ? new Date(from) : from;
  if (isNaN(t.getTime()) || isNaN(f.getTime())) return null;
  const tp = getJakartaParts(t);
  const fp = getJakartaParts(f);
  if (!tp || !fp) return null;
  const targetDay = Date.UTC(tp.year, tp.month - 1, tp.day);
  const fromDay = Date.UTC(fp.year, fp.month - 1, fp.day);
  return Math.round((targetDay - fromDay) / 86_400_000);
}

/**
 * Calendar days until the next birthday in Jakarta.
 * 0 = today (even after midnight), 1 = tomorrow, n = n calendar days away.
 */
export function getDaysUntilNextBirthday(
  birthDate: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!birthDate) return 0;
  const d = typeof birthDate === "string" ? new Date(birthDate) : new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const bdParts = getJakartaParts(d);
  const todayParts = getJakartaParts(now);
  if (!bdParts || !todayParts) return 0;

  // On the birthday itself getNextBirthday has already rolled to next year,
  // so answer "today" before asking it.
  if (bdParts.month === todayParts.month && bdParts.day === todayParts.day) {
    return 0;
  }

  const next = getNextBirthday(d, now);
  if (!next) return 0;
  return getJakartaDayDiff(next, now) ?? 0;
}

export function getAge(
  birthDate: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!birthDate) return 0;
  const d = typeof birthDate === "string" ? new Date(birthDate) : new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const bdParts = getJakartaParts(d);
  const todayParts = getJakartaParts(now);
  if (!bdParts || !todayParts) return 0;

  let age = todayParts.year - bdParts.year;
  if (todayParts.month < bdParts.month || (todayParts.month === bdParts.month && todayParts.day < bdParts.day)) {
    age--;
  }
  return age;
}

export function getYearsSince(date: Date | string, now: Date = new Date()): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return 0;
  const dateParts = getJakartaParts(d);
  const todayParts = getJakartaParts(now);
  if (!dateParts || !todayParts) return 0;

  let years = todayParts.year - dateParts.year;
  if (todayParts.month < dateParts.month || (todayParts.month === dateParts.month && todayParts.day < dateParts.day)) {
    years--;
  }
  return years;
}

export function isSameDayJakarta(date1: Date | string, date2: Date | string): boolean {
  if (!date1 || !date2) return false;
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  const p1 = getJakartaParts(d1);
  const p2 = getJakartaParts(d2);
  if (!p1 || !p2) return false;
  return p1.year === p2.year && p1.month === p2.month && p1.day === p2.day;
}

export function isSameMonthDayJakarta(date1: Date | string, date2: Date | string): boolean {
  if (!date1 || !date2) return false;
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  const p1 = getJakartaParts(d1);
  const p2 = getJakartaParts(d2);
  if (!p1 || !p2) return false;
  return p1.month === p2.month && p1.day === p2.day;
}

export function toJakartaMidnight(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const parts = getJakartaParts(d);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

export function getJakartaDateOnly(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const parts = getJakartaParts(d);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function jakartaStartOfDay(): Date {
  const parts = getJakartaParts(new Date());
  if (!parts) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

export function jakartaEndOfDay(): Date {
  const parts = getJakartaParts(new Date());
  if (!parts) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999) - 7 * 60 * 60 * 1000);
}

export function getJakartaToday(now: Date = new Date()): string {
  const parts = getJakartaParts(now);
  if (!parts) return new Date().toISOString().split("T")[0];
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Jakarta calendar day key (`YYYY-MM-DD`) shifted by whole days.
 * `getJakartaDayKey(-1)` is yesterday, so daily streaks can compare day keys
 * without ever touching the browser's local timezone.
 */
export function getJakartaDayKey(offsetDays = 0, now: Date = new Date()): string {
  const parts = getJakartaParts(now);
  if (!parts) return getJakartaToday(now);
  return getJakartaDateOnly(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays)),
  );
}

/**
 * Milliseconds until the next 00:00 Asia/Jakarta. Used to schedule a single
 * timer that flips "today" exactly at Jakarta midnight (instead of polling).
 */
export function msUntilNextJakartaMidnight(now: Date = new Date()): number {
  const parts = getJakartaParts(now);
  if (!parts) {
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(next.getTime() - now.getTime(), 0);
  }
  const nextMidnight =
    Date.UTC(parts.year, parts.month - 1, parts.day + 1) - JAKARTA_OFFSET_MS;
  return Math.max(nextMidnight - now.getTime(), 0);
}

export function getJakartaYear(): number {
  const parts = getJakartaParts(new Date());
  return parts?.year ?? new Date().getFullYear();
}

export function getElapsedSince(
  date: Date | string,
  now: Date = new Date(),
): { years: number; months: number; days: number } {
  if (!date) return { years: 0, months: 0, days: 0 };
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return { years: 0, months: 0, days: 0 };
  const dateParts = getJakartaParts(d);
  const todayParts = getJakartaParts(now);
  if (!dateParts || !todayParts) return { years: 0, months: 0, days: 0 };

  let years = todayParts.year - dateParts.year;
  let months = todayParts.month - dateParts.month;
  let days = todayParts.day - dateParts.day;

  if (days < 0) {
    months--;
    const daysInPrevMonth = new Date(todayParts.year, todayParts.month - 1, 0).getDate();
    days += daysInPrevMonth;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
}
