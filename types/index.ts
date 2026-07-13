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
  WishItem,
  Role,
  LetterMood,
  GameType,
};

// ── Extended Types ───────────────────────

export type AlbumWithCount = Album & { _count: { photos: number } };

// ── API Response Types ────────────────────

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  status: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type CursorPaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
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
};

export type RecentActivity = {
  id: string;
  type: "photo" | "letter" | "milestone" | "note";
  description: string;
  createdAt: Date;
  user: Pick<User, "id" | "name" | "image">;
};

// ── Upload Types ──────────────────────────

export type UploadResult = {
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format?: string;
};

// ── Query Params ──────────────────────────

export type PhotoQueryParams = {
  albumId?: string;
  year?: number;
  isFavorite?: boolean;
  page?: number;
  limit?: number;
};

export type LetterQueryParams = {
  type: "inbox" | "sent";
};

export type MilestoneQueryParams = {
  withPhotos?: boolean;
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
  | 'GAMES';

export type SyncAction = 'REFRESH';

export type SyncPayload = {
  scope: SyncScope;
  action: SyncAction;
};

declare global {
  // eslint-disable-next-line no-var
  var pusherServer: import('pusher') | undefined;
}
