"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Home,
  Image,
  CalendarDays,
  Gamepad2,
  StickyNote,
  Gift,
  MessageCircleHeart,
  LayoutDashboard,
  LogIn,
  MapPin,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", short: "Home", icon: Home },
  { href: "/gallery", label: "Gallery", short: "Gallery", icon: Image },
  { href: "/timeline", label: "Timeline", short: "Timeline", icon: CalendarDays },
  { href: "/games", label: "Games", short: "Games", icon: Gamepad2 },
  { href: "/notes", label: "Daily Note", short: "Note", icon: StickyNote },
  { href: "/wishlist", label: "Wish List", short: "Wish", icon: Gift },
  { href: "/letters", label: "Letters", short: "Letters", icon: MessageCircleHeart },
  { href: "/dashboard/location", label: "Location", short: "Loc", icon: MapPin, auth: true },
  { href: "/dashboard", label: "Dashboard", short: "Dash", icon: LayoutDashboard, auth: true },
  { href: "/login", label: "Login", short: "Login", icon: LogIn, guest: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = navItems.filter((item) => {
    if ("auth" in item && item.auth) return !!session?.user;
    if ("guest" in item && item.guest) return !session?.user;
    return true;
  });

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLAnchorElement>('[data-active="true"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [pathname, items.length]);

  return (
    <nav suppressHydrationWarning className="fixed bottom-0 right-0 left-0 z-40 lg:hidden">
      <div
        suppressHydrationWarning
        className="border-t border-border bg-background/80 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          suppressHydrationWarning
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
                suppressHydrationWarning
                data-active={active || undefined}
                className={cn(
                  "relative flex snap-center flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
                  "min-w-0 flex-1 sm:flex-[1_1_0%]",
                  active ? "text-primary" : "text-muted-foreground",
                  "hover:text-foreground",
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5",
                  active && "fill-primary/20",
                )} />
                <span className="sm:hidden whitespace-nowrap">{item.short}</span>
                <span className="hidden sm:inline whitespace-nowrap">{item.label}</span>
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
