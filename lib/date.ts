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
  return d.toLocaleDateString("id-ID", {
    timeZone: TIMEZONE,
    ...options,
  });
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

export function getNextBirthday(birthDate: Date | string | null | undefined): Date | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const bdParts = getJakartaParts(d);
  const todayParts = getJakartaParts(new Date());
  if (!bdParts || !todayParts) return null;

  const thisYear = todayParts.year;

  const thisBirthday = new Date(`${thisYear}-${String(bdParts.month).padStart(2, "0")}-${String(bdParts.day).padStart(2, "0")}T00:00:00+07:00`);
  if (isNaN(thisBirthday.getTime())) return null;
  const now = new Date();

  if (thisBirthday >= now) {
    return thisBirthday;
  }

  const next = new Date(`${thisYear + 1}-${String(bdParts.month).padStart(2, "0")}-${String(bdParts.day).padStart(2, "0")}T00:00:00+07:00`);
  return isNaN(next.getTime()) ? null : next;
}

export function getAge(birthDate: Date | string | null | undefined): number {
  if (!birthDate) return 0;
  const d = typeof birthDate === "string" ? new Date(birthDate) : new Date(birthDate);
  if (isNaN(d.getTime())) return 0;
  const bdParts = getJakartaParts(d);
  const todayParts = getJakartaParts(new Date());
  if (!bdParts || !todayParts) return 0;

  let age = todayParts.year - bdParts.year;
  if (todayParts.month < bdParts.month || (todayParts.month === bdParts.month && todayParts.day < bdParts.day)) {
    age--;
  }
  return age;
}

export function getYearsSince(date: Date | string): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return 0;
  const dateParts = getJakartaParts(d);
  const todayParts = getJakartaParts(new Date());
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

export function getJakartaToday(): string {
  const now = new Date();
  const parts = getJakartaParts(now);
  if (!parts) return new Date().toISOString().split("T")[0];
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getJakartaYear(): number {
  const parts = getJakartaParts(new Date());
  return parts?.year ?? new Date().getFullYear();
}

export function getElapsedSince(date: Date | string): { years: number; months: number; days: number } {
  if (!date) return { years: 0, months: 0, days: 0 };
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return { years: 0, months: 0, days: 0 };
  const dateParts = getJakartaParts(d);
  const todayParts = getJakartaParts(new Date());
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
