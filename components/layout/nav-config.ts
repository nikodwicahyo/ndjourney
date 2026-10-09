import type { ComponentType } from "react";
import {
  Home,
  Image,
  CalendarDays,
  Gamepad2,
  MessageCircleHeart,
  StickyNote,
  Gift,
  MapPin,
  LayoutDashboard,
  LogIn,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** visible only when logged in */
  auth?: boolean;
  /** visible only when logged out */
  guest?: boolean;
};

// One IA for every device: same order, labels and icons in Navbar
// (desktop), BottomNav (mobile) and More. Primaries render first,
// secondary items append after — both bars show the full set.
export const primaryNav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/letters", label: "Letters", icon: MessageCircleHeart },
];

export const moreNav: NavItem[] = [
  { href: "/wishlist", label: "Wishlist", icon: Gift },
  { href: "/location", label: "Location", icon: MapPin, auth: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: true },
  { href: "/login", label: "Login", icon: LogIn, guest: true },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function visibleNav(items: NavItem[], isAuthed: boolean): NavItem[] {
  return items.filter((item) => {
    if (item.auth) return isAuthed;
    if (item.guest) return !isAuthed;
    return true;
  });
}
