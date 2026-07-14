export const queryKeys = {
  couple: {
    all: ["couple"] as const,
    config: () => ["couple", "config"] as const,
  },
  photos: {
    all: ["photos"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["photos", "list", filters] as const,
    detail: (id: string) => ["photos", "detail", id] as const,
  },
  albums: {
    all: ["albums"] as const,
    list: () => ["albums", "list"] as const,
  },
  milestones: {
    all: ["milestones"] as const,
    list: () => ["milestones", "list"] as const,
    detail: (id: string) => ["milestones", "detail", id] as const,
  },
  letters: {
    all: ["letters"] as const,
    list: (type: "inbox" | "sent") => ["letters", "list", type] as const,
    detail: (id: string) => ["letters", "detail", id] as const,
  },
  notes: {
    all: ["notes"] as const,
    list: (date?: string) => ["notes", "list", date] as const,
  },
  games: {
    all: ["games"] as const,
    questions: (type: string, count?: number, exclude?: string[]) =>
      ["games", "questions", type, count ?? "all", exclude?.join(",") ?? "all"] as const,
    leaderboard: () => ["games", "leaderboard"] as const,
    arcadeLeaderboard: (type?: string) => ["games", "arcade-leaderboard", type] as const,
  },
  wishes: {
    all: ["wishes"] as const,
    list: () => ["wishes", "list"] as const,
  },
  dashboard: {
    stats: () => ["dashboard", "stats"] as const,
    activity: () => ["dashboard", "activity"] as const,
  },
  storage: {
    usage: () => ["storage", "usage"] as const,
  },
  partner: {
    all: () => ["partner"] as const,
  },
} as const;
