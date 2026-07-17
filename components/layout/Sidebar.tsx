"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageCircleHeart,
  Gamepad2,
  StickyNote,
  Gift,
  Settings,
  Heart,
  LogOut,
  Image,
  CalendarDays,
  User,
  MapPin,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui";

export const sidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/gallery", label: "Gallery", icon: Image },
  { href: "/dashboard/location", label: "Location", icon: MapPin },
  { href: "/dashboard/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/dashboard/games", label: "Games", icon: Gamepad2 },
  { href: "/dashboard/notes", label: "Daily Note", icon: StickyNote },
  { href: "/dashboard/wishlist", label: "Wish List", icon: Gift },
  { href: "/dashboard/letters", label: "Letters", icon: MessageCircleHeart },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;
    if (href !== "/dashboard") return pathname.startsWith(href);
    return false;
  };
}

export function SidebarContent() {
  const { data: session } = useSession();
  const isActive = useIsActive();

  return (
    <div className="flex h-full flex-col">
      {session?.user && (
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Avatar className="h-9 w-9">
            <AvatarImage src={session.user.image || undefined} />
            <AvatarFallback>
              {session.user.name?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center gap-2 px-3">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Menu
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-3 py-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="fixed top-16 bottom-0 left-0 z-30 w-64 border-r border-border bg-background">
        <SidebarContent />
      </div>
    </aside>
  );
}
