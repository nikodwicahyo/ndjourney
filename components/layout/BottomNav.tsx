"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  primaryNav,
  moreNav,
  isNavActive,
  visibleNav,
} from "./nav-config";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => isNavActive(pathname, href);
  // Show-all: primaries + secondary in config order, one scrollable row.
  const items = [...primaryNav, ...visibleNav(moreNav, !!session?.user)];

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRef.current
      ?.querySelector<HTMLAnchorElement>('[data-active="true"]')
      ?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [pathname, items.length]);

  return (
    <nav aria-label="Navigasi utama" className="fixed bottom-0 right-0 left-0 z-40 lg:hidden">
      <div
        className="relative border-t border-border bg-background/80 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          ref={scrollRef}
          className="scrollbar-hide flex snap-x snap-proximity items-stretch overflow-x-auto"
        >
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] min-w-[64px] flex-1 snap-center flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                  "hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "fill-primary/20")} aria-hidden="true" />
                <span className="whitespace-nowrap">{item.label}</span>
                {active && (
                  <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </nav>
  );
}
