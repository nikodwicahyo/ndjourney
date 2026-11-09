"use client";

import { useEffect, useRef } from "react";
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { toast } from "sonner";
import { clearServiceWorkerCaches, signOutAndClear } from "@/lib/sign-out";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

function SessionWatcher() {
  const { data: session, status, update: updateSession } = useSession();
  const wasAuthenticated = useRef(false);
  // One expiry confirmation at a time — a slow probe must not stack up.
  const verifyingRef = useRef(false);
  // Session photo URLs probed already — each distinct URL is checked once.
  const probedImageRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      wasAuthenticated.current = true;
      return;
    }

    if (!wasAuthenticated.current || verifyingRef.current) return;

    // next-auth reports ANY failed session probe (offline fetch, 5xx, the
    // service worker's offline 503) as `null` — indistinguishable from a
    // real logout — so a network blip must never be announced as expiry.
    // Confirm against the server first. A confirmation that still carries a
    // user also repairs the provider: its poll stops once it holds `null`,
    // which would otherwise leave realtime/location dead until a reload.
    verifyingRef.current = true;
    let cancelled = false;

    const verifySession = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        // Inconclusive (offline / 503 / 5xx): say nothing; the next poll or
        // page load re-checks.
        if (cancelled || !res.ok) return;
        const data = await res.json().catch(() => null);
        // Malformed body — inconclusive, never evidence of expiry.
        if (cancelled || !data || typeof data !== "object") return;

        if ((data as { user?: unknown }).user) {
          wasAuthenticated.current = true;
          // Restore the provider's client state so polling/realtime resume.
          void updateSession().catch(() => {});
          return;
        }

        wasAuthenticated.current = false;
        clearServiceWorkerCaches();
        toast.error("Sesi berakhir. Silakan login kembali.", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => signOutAndClear({ callbackUrl: "/login?reason=expired" }),
          },
        });
      } catch {
        // Network failure — not evidence of expiry.
      } finally {
        if (!cancelled) verifyingRef.current = false;
      }
    };

    void verifySession();

    return () => {
      cancelled = true;
      verifyingRef.current = false;
    };
  }, [session, status, updateSession]);

  // Self-heal a stale session photo: if the token points at a rotated/deleted
  // asset, Navbar/Sidebar fall back to the initial while API-driven avatars
  // look fine. Probing reuses the browser cache (the avatar already attempted
  // this URL), and a real refresh POST re-stamps the token from the DB.
  useEffect(() => {
    const image = session?.user?.image;
    if (status !== "authenticated" || !image || probedImageRef.current === image) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) probedImageRef.current = image;
    };
    probe.onerror = () => {
      if (cancelled) return;
      probedImageRef.current = image;
      void updateSession({});
    };
    probe.src = getOptimizedImageUrl(image, 64, { quality: "auto:eco" });
    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [session?.user?.image, status, updateSession]);

  return null;
}

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider refetchInterval={4 * 60} refetchOnWindowFocus={false}>
      <SessionWatcher />
      {children}
    </NextAuthSessionProvider>
  );
}
