"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";
import { useMounted } from "@/hooks/useMounted";
import { Avatar, AvatarFallback, AvatarImage, Button, Sheet, SheetContent } from "@/components/ui";
import { SidebarContent } from "./Sidebar";
import { showDeleteConfirm } from "@/lib/swal";
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
  Moon,
  Sun,
  LogOut,
  Settings,
  LayoutDashboard,
  User,
  Menu,
  X,
} from "lucide-react";
import {
  primaryNav,
  moreNav,
  isNavActive,
  visibleNav,
} from "./nav-config";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const mounted = useMounted();
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  const handleLogout = async () => {
    const confirmed = await showDeleteConfirm({
      title: "Keluar dari akun?",
      text: "Apakah Anda yakin ingin keluar?",
      confirmText: "Ya, keluar",
      cancelText: "Batal",
    });
    if (confirmed) signOut({ callbackUrl: "/" });
  };

  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const isActive = (href: string) => isNavActive(pathname, href);

  const isAuthed = !!session?.user;
  // Desktop has its own Login button, so the More dropdown skips guest items.
  const desktopMore = visibleNav(moreNav, isAuthed).filter((i) => !i.guest);

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
            <Heart className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
            <span className="text-sm sm:text-lg">NDjourney</span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-0.5 lg:flex">
            {[...primaryNav, ...desktopMore].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                suppressHydrationWarning
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors xl:px-3",
                  isActive(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                aria-label="Ganti tema"
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
                    <button
                      aria-label="Menu akun"
                      className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent"
                    >
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
                    <DropdownMenuItem onClick={handleLogout}>
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
                aria-label={sidebarOpen ? "Tutup menu" : "Buka menu"}
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
