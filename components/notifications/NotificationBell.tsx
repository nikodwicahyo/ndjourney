"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Flag,
  Gamepad2,
  Heart,
  HelpCircle,
  Image,
  Mail,
  MapPin,
  Star,
  User,
} from "lucide-react";
import { Button, Sheet, SheetContent } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationsSeen, useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/utils";
import type { NotificationItem } from "@/types";

// Same type vocabulary as the activity emitters (lib/activity.ts).
const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  photo: { icon: Image, color: "#6366F1" },
  letter: { icon: Mail, color: "#EC4899" },
  milestone: { icon: Flag, color: "#F97316" },
  note: { icon: Heart, color: "#14B8A6" },
  wish: { icon: Star, color: "#EAB308" },
  game: { icon: Gamepad2, color: "#22C55E" },
  arcade: { icon: Gamepad2, color: "#22C55E" },
  profile: { icon: User, color: "#8B5CF6" },
  location: { icon: MapPin, color: "#0EA5E9" },
  questions: { icon: HelpCircle, color: "#F43F5E" },
};

function NotificationRow({
  item,
  onSelect,
}: {
  item: NotificationItem;
  onSelect: (item: NotificationItem) => void;
}) {
  const config = typeConfig[item.type] ?? typeConfig.photo;
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: config.color + "15" }}
      >
        <Icon className="h-4 w-4" style={{ color: config.color }} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {item.unread && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Belum dibaca"
            />
          )}
        </span>
        {item.body && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.body}
          </span>
        )}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatRelativeTime(item.createdAt)}
        </span>
      </span>
    </button>
  );
}

function NotificationPanel({
  onSelect,
  onRetry,
}: {
  onSelect: (item: NotificationItem) => void;
  onRetry: () => void;
}) {
  const { data, isLoading, error } = useNotifications();
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Notifikasi</p>
        {unreadCount > 0 && (
          <span className="text-xs text-muted-foreground">{unreadCount} baru</span>
        )}
      </div>

      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Memuat notifikasi...
        </p>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Gagal memuat notifikasi</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
        </div>
      ) : (
        <div className="p-1">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function BellButton({
  unreadCount,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { unreadCount: number }) {
  const label =
    unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi";
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={label}
      aria-haspopup="dialog"
      {...props}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
        >
          {badge}
        </span>
      )}
    </Button>
  );
}

/** Partner activity bell: dropdown on desktop, full-width sheet on mobile. */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // This is a client-only breakpoint switch; before mount/hydration the
  // desktop panel is a safe default (it renders no floating content closed).
  const [isDesktop, setIsDesktop] = useState(true);
  const { data, refetch } = useNotifications();
  const markSeen = useMarkNotificationsSeen();
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  function handleSelect(item: NotificationItem) {
    setOpen(false);
    markSeen.mutate();
    if (item.href) router.push(item.href);
  }

  const panel = <NotificationPanel onSelect={handleSelect} onRetry={() => void refetch()} />;

  return (
    <div className="relative">
      {isDesktop ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <BellButton unreadCount={unreadCount} aria-expanded={open} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            role="dialog"
            aria-label="Notifikasi"
            className="w-80 max-w-[calc(100vw-2rem)] p-0"
          >
            {panel}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <BellButton
            unreadCount={unreadCount}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              role="dialog"
              aria-modal="true"
              aria-label="Notifikasi"
              className="w-full p-0"
            >
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
