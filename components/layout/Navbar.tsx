"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";
import { Avatar, AvatarFallback, AvatarImage, Button, Sheet, SheetContent } from "@/components/ui";
import { SidebarContent } from "./Sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heart,
  Home,
  Image,
  CalendarDays,
  Gamepad2,
  StickyNote,
  Gift,
  MessageCircleHeart,
  Moon,
  Sun,
  LogOut,
  Settings,
  LayoutDashboard,
  User,
  Menu,
  X,
  MapPin,
} from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/notes", label: "Note", icon: StickyNote },
  { href: "/wishlist", label: "Wish", icon: Gift },
  { href: "/letters", label: "Letters", icon: MessageCircleHeart },
];

const privateLinks = [
  { href: "/dashboard/location", label: "Location", icon: MapPin },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const links = session?.user ? [...navLinks, ...privateLinks] : navLinks;

  return (
    <>
      <header
        suppressHydrationWarning
        className={cn(
          "fixed top-0 right-0 left-0 z-40 transition-all duration-300",
          scrolled
            ? "border-b border-border/50 bg-background/80 backdrop-blur-xl"
            : "bg-transparent",
        )}
      >
        <div suppressHydrationWarning className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            prefetch={true}
            className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground shrink-0"
          >
            <Heart className="h-5 w-5 fill-primary text-primary" />
            <span className="text-sm sm:text-lg">NDjourney</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                suppressHydrationWarning
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors xl:px-4",
                  isActive(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div suppressHydrationWarning className="flex items-center gap-2">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            {session?.user ? (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={session.user.image || undefined} />
                        <AvatarFallback>
                          {session.user.name?.charAt(0) ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>
                      {session.user.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {session.user.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                      <User className="h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                      <LogOut className="h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link
                href="/login"
                prefetch={true}
                suppressHydrationWarning
                className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Login
              </Link>
            )}

            {isDashboard && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>
      </header>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 lg:hidden">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
