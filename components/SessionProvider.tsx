"use client";

import { useEffect, useRef } from "react";
import { SessionProvider as NextAuthSessionProvider, useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

function SessionWatcher() {
  const { data: session, status } = useSession();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      wasAuthenticated.current = true;
      return;
    }

    if (wasAuthenticated.current && !session?.user) {
      wasAuthenticated.current = false;
      toast.error("Sesi berakhir. Silakan login kembali.", {
        duration: 5000,
        action: {
          label: "Login",
          onClick: () => signOut({ callbackUrl: "/login?reason=expired" }),
        },
      });
    }
  }, [session, status]);

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
