"use client";

import Link from "next/link";
import { useRecentActivity } from "@/hooks/useDashboard";
import { Button, Skeleton, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { motion } from "framer-motion";
import { Image, Mail, Flag, Heart, History, Star, Gamepad2, User, MapPin, HelpCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

const typeConfig = {
  photo: { icon: Image, color: "#6366F1", href: (id: string) => `/dashboard/gallery` },
  letter: {
    icon: Mail,
    color: "#EC4899",
    // `id` is the ActivityEvent id, not the letter id → link the list.
    href: (_id: string) => `/dashboard/letters`,
  },
  milestone: {
    icon: Flag,
    color: "#F97316",
    href: (_id: string) => `/dashboard/timeline`,
  },
  note: { icon: Heart, color: "#14B8A6", href: (_id: string) => `/dashboard/notes` },
  wish: { icon: Star, color: "#EAB308", href: (_id: string) => `/dashboard/wishlist` },
  game: { icon: Gamepad2, color: "#22C55E", href: (_id: string) => `/dashboard/games` },
  arcade: { icon: Gamepad2, color: "#22C55E", href: (_id: string) => `/dashboard/games` },
  profile: { icon: User, color: "#8B5CF6", href: (_id: string) => `/dashboard/settings` },
  location: { icon: MapPin, color: "#0EA5E9", href: (_id: string) => `/location` },
  questions: { icon: HelpCircle, color: "#F43F5E", href: (_id: string) => `/dashboard/games` },
};

export default function RecentActivity() {
  const { data: activity, isLoading, error, refetch } = useRecentActivity();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Gagal memuat aktivitas
        </p>
        <Button type="button" size="sm" onClick={() => refetch()} className="mt-3">
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          Belum ada aktivitas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activity.map((item, i) => {
        // Unknown type from a newer event emitter must not crash the feed.
        const config = typeConfig[item.type as keyof typeof typeConfig] ?? typeConfig.photo;
        const Icon = config.icon;

        return (
          <motion.div
            key={`${item.type}-${item.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
          >
            <Link
              href={config.href(item.id)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all duration-300 hover:scale-[1.01] hover:shadow-md"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: config.color + "15" }}
              >
                <Icon className="h-4 w-4" style={{ color: config.color }} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.description}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={item.user.image ?? undefined} alt={item.user.name ?? "User"} />
                    <AvatarFallback>{item.user.name?.charAt(0) || "P"}</AvatarFallback>
                  </Avatar>
                  <span>{item.user.name || "Pasangan"}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
