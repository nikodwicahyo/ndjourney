// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getDaysUntilNextBirthday } from "@/lib/date";

// The dashboard card reads its data from TanStack hooks; mock them so the
// component is exercised without a QueryClient.
const stats = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const config = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardStats: () => ({
    data: stats.current,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCoupleConfig: () => ({ data: config.current, isLoading: false }),
}));

const { default: BirthdayCountdown } = await import("@/components/home/BirthdayCountdown");
const { default: StatsCards } = await import("@/components/dashboard/StatsCards");

// framer-motion's useInView needs an IntersectionObserver; jsdom has none.
// It only gates the entrance animation, so a no-op stub is enough here.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Stored birth date = Jakarta midnight 1990-11-12.
const BIRTHDAY_NOV_12 = "1990-11-11T17:00:00.000Z";

const baseStats = {
  photoCount: 0,
  videoCount: 0,
  letterCount: 0,
  unreadLetterCount: 0,
  milestoneCount: 0,
  daysSinceAnniversary: 10,
  daysUntilBirthday1: 1,
  daysUntilBirthday2: 20,
  birthday1Age: 21,
  birthday2Age: 20,
  storageUsed: 0,
  storageLimit: 0,
};

const baseConfig = {
  name1: "Dzikria",
  name2: "Niko",
  birthDate1: BIRTHDAY_NOV_12,
  birthDate2: "1991-01-01T17:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("getDaysUntilNextBirthday", () => {
  it("counts calendar days, not elapsed 24h blocks", () => {
    const bd = new Date(BIRTHDAY_NOV_12);
    expect(getDaysUntilNextBirthday(bd, new Date("2026-11-10T10:00:00Z"))).toBe(2);
    expect(getDaysUntilNextBirthday(bd, new Date("2026-11-11T10:31:00Z"))).toBe(1);
    expect(getDaysUntilNextBirthday(bd, new Date("2026-11-11T16:59:00Z"))).toBe(1);
    expect(getDaysUntilNextBirthday(bd, new Date("2026-11-12T03:00:00Z"))).toBe(0);
  });
});

describe("BirthdayCountdown", () => {
  it("says Besok (not Hari ini) the evening before the birthday", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T10:31:00Z")); // 17:31 Jakarta
    render(<BirthdayCountdown birthDate={BIRTHDAY_NOV_12} name="Dzikria" />);
    expect(screen.getByText("Besok!")).toBeTruthy();
    expect(screen.queryByText("Hari ini!")).toBeNull();
  });

  it("celebrates on the birthday itself", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T03:00:00Z")); // 10:00 Jakarta
    render(<BirthdayCountdown birthDate={BIRTHDAY_NOV_12} name="Dzikria" />);
    expect(screen.getByText("Selamat Ulang Tahun Dzikria!")).toBeTruthy();
  });
});

describe("StatsCards birthday state", () => {
  it("shows the day count before the birthday", () => {
    stats.current = { ...baseStats, daysUntilBirthday1: 1 };
    config.current = baseConfig;
    render(<StatsCards />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText(/Selamat Ulang Tahun/)).toBeNull();
  });

  it("shows the celebration only on the birthday (0 days)", () => {
    stats.current = { ...baseStats, daysUntilBirthday1: 0 };
    config.current = baseConfig;
    render(<StatsCards />);
    expect(screen.getByText("🎉 Selamat Ulang Tahun")).toBeTruthy();
    expect(screen.getByText("Ultah Dzikria")).toBeTruthy();
  });
});
