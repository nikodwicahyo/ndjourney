"use client";

import { useEffect, useRef } from "react";
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { toast } from "sonner";
import { clearServiceWorkerCaches, signOutAndClear } from "@/lib/sign-out";
import { getOptimizedImageUrl } from "@/lib/cloudinary-urls";

function SessionWatcher() {
  const { data: session, status, update: updateSession } = useSession();
  const wasAuthenticated = useRef(false);
  // Session photo URLs probed already — each distinct URL is checked once.
  const probedImageRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      wasAuthenticated.current = true;
      return;
    }

    if (wasAuthenticated.current && !session?.user) {
      wasAuthenticated.current = false;
      clearServiceWorkerCaches();
      toast.error("Sesi berakhir. Silakan login kembali.", {
        duration: 5000,
        action: {
          label: "Login",
          onClick: () => signOutAndClear({ callbackUrl: "/login?reason=expired" }),
        },
      });
    }
  }, [session, status]);

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
