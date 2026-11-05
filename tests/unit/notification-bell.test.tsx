// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { NotificationItem, NotificationsResponse } from "@/types";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
}));

const { default: NotificationBell } = await import(
  "@/components/notifications/NotificationBell"
);

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "evt-1",
    type: "photo",
    action: "created",
    title: "Foto baru",
    body: "Niko menambahkan foto",
    href: "/gallery",
    createdAt: new Date().toISOString(),
    actor: { id: "partner-1", name: "Niko", image: null },
    unread: true,
    ...overrides,
  };
}

let payload: NotificationsResponse;
let fetchMock: ReturnType<typeof vi.fn>;

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(<NotificationBell />, { wrapper });
}

beforeEach(() => {
  nav.push.mockReset();
  payload = { items: [item()], unreadCount: 1, nextCursor: null };
  fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function seenPosted() {
  return fetchMock.mock.calls.some(
    ([url, init]) =>
      String(url).includes("/api/notifications/seen") &&
      (init as RequestInit | undefined)?.method === "POST",
  );
}

describe("NotificationBell", () => {
  it("shows the unread count in an accessible badge", async () => {
    payload.unreadCount = 3;
    renderBell();

    const bell = await screen.findByRole("button", { name: "Notifikasi, 3 belum dibaca" });
    expect(bell.textContent).toContain("3");
  });

  it("caps the badge at 99+", async () => {
    payload.unreadCount = 250;
    renderBell();

    const bell = await screen.findByRole("button", { name: "Notifikasi, 250 belum dibaca" });
    expect(bell.textContent).toContain("99+");
  });

  it("hides the badge when nothing is unread", async () => {
    payload.unreadCount = 0;
    renderBell();

    const bell = await screen.findByRole("button", { name: "Notifikasi" });
    expect(bell.textContent?.trim()).not.toMatch(/\d/);
  });

  it("shows the Indonesian empty state", async () => {
    payload = { items: [], unreadCount: 0, nextCursor: null };
    renderBell();

    fireEvent.click(await screen.findByRole("button", { name: "Notifikasi" }));

    expect(await screen.findByText("Belum ada aktivitas")).toBeTruthy();
  });

  it("marks notifications seen and navigates when a row is clicked", async () => {
    renderBell();

    fireEvent.click(await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" }));
    fireEvent.click(await screen.findByText("Foto baru"));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/gallery"));
    await waitFor(() => expect(seenPosted()).toBe(true));
    // optimistic clear: the badge disappears without waiting for a refetch
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifikasi" })).toBeTruthy(),
    );
  });

  it("does not navigate when the event has no href", async () => {
    payload = { items: [item({ href: null })], unreadCount: 1, nextCursor: null };
    renderBell();

    fireEvent.click(await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" }));
    fireEvent.click(await screen.findByText("Foto baru"));

    await waitFor(() => expect(seenPosted()).toBe(true));
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the bell", async () => {
    renderBell();

    const bell = await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" });
    fireEvent.click(bell);
    expect(await screen.findByText("Foto baru")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByText("Foto baru")).toBeNull());
    expect(document.activeElement).toBe(bell);
  });

  it("portals the mobile sheet to <body> so the blurred header cannot trap it", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderBell();

    fireEvent.click(await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" }));
    const row = await screen.findByText("Foto baru");
    const dialog = row.closest('[role="dialog"]');

    expect(dialog).toBeTruthy();
    expect(dialog?.parentElement).toBe(document.body);
  });
});
