import type {
  User,
  CoupleConfig,
  Photo,
  Album,
  Milestone,
  MilestonePhoto,
  Letter,
  DailyNote,
  GameQuestion,
  GameScore,
  GameArcadeScore,
  WishItem,
  Role,
  LetterMood,
  GameType,
} from "@/lib/generated/prisma";

export type {
  User,
  CoupleConfig,
  Photo,
  Album,
  Milestone,
  MilestonePhoto,
  Letter,
  DailyNote,
  GameQuestion,
  GameScore,
  GameArcadeScore,
  WishItem,
  Role,
  LetterMood,
  GameType,
};

// ── Extended Types ───────────────────────

export type AlbumWithCount = Album & { _count: { photos: number } };

export type PhotoWithUploader = Photo & {
  uploadedByName?: string | null;
  uploadedByImage?: string | null;
  uploadedBy?: { id: string; name: string | null; image: string | null } | null;
  fileSize?: number | null;
};

// ── Dashboard Types ───────────────────────

export type DashboardStats = {
  photoCount: number;
  videoCount: number;
  letterCount: number;
  milestoneCount: number;
  daysSinceAnniversary: number;
  unreadLetterCount: number;
  daysUntilBirthday1: number;
  daysUntilBirthday2: number;
  birthday1Age: number;
  birthday2Age: number;
  storageUsed: number;
  storageLimit: number;
};

export type CloudinaryUsage = {
  storageUsed: number;
  storageLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  resourcesCount: number;
  imagesBytes?: number;
  videosBytes?: number;
  rawBytes?: number;
  imagesCount?: number;
  videosCount?: number;
  rawCount?: number;
};

export type RecentActivity = {
  id: string;
  type: "photo" | "letter" | "milestone" | "note";
  description: string;
  createdAt: Date;
  user: Pick<User, "id" | "name" | "image">;
};

// ── Letter Types ──────────────────────────

export const LETTER_MOOD_CONFIG: Record<
  LetterMood,
  { emoji: string; label: string; color: string }
> = {
  LOVE: { emoji: "❤️", label: "Cinta", color: "#F43F5E" },
  GRATEFUL: { emoji: "🙏", label: "Terima Kasih", color: "#22C55E" },
  MISSING: { emoji: "🥺", label: "Kangen", color: "#6366F1" },
  HAPPY: { emoji: "😊", label: "Happy", color: "#EAB308" },
  APOLOGY: { emoji: "💝", label: "Minta Maaf", color: "#EC4899" },
  SURPRISE: { emoji: "🎉", label: "Kejutan", color: "#F97316" },
};

// ── Navigation ────────────────────────────

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  requiresAuth?: boolean;
};

// ── Pusher / Real-time Sync Types ────────────

export type SyncScope =
  | 'GALLERY'
  | 'TIMELINE'
  | 'LETTERS'
  | 'DAILY_NOTES'
  | 'WISHLIST'
  | 'DASHBOARD'
  | 'GAMES_LEADERBOARD'
  | 'GAMES_QUESTIONS'
  | 'PROFILE'
  | 'LOCATION';

export type SyncAction = 'REFRESH';

export type SyncPayload = {
  scope: SyncScope;
  action: SyncAction;
};

declare global {
  var pusherServer: import('pusher') | undefined;
}
