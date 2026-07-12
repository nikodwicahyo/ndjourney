"use client";

import TimelinePreview from "./TimelinePreview";
import NotesPreview from "./NotesPreview";
import GamesPreview from "./GamesPreview";
import WishlistPreview from "./WishlistPreview";
import LettersPreview from "./LettersPreview";

export type HomeSummaries = {
  timeline: {
    milestoneCount: number;
    latestMilestones: Array<{ id: string; title: string; icon: string | null; color: string | null; date: Date }>;
  };
  notes: {
    noteCount: number;
    latestNote: { content: string; authorName: string; authorImage: string | null } | null;
  };
  games: {
    questionCount: number;
    totalGamesPlayed: number;
  };
  wishlist: {
    total: number;
    done: number;
  };
  letters: {
    totalCount: number;
  };
};

type HomeStatsProps = {
  summaries: HomeSummaries;
};

export default function HomeStats({ summaries }: HomeStatsProps) {
  const { timeline, notes, games, wishlist, letters } = summaries;

  return (
    <div className="space-y-8">
      <TimelinePreview
        milestoneCount={timeline.milestoneCount}
        latestMilestones={timeline.latestMilestones}
      />

      <NotesPreview
        noteCount={notes.noteCount}
        latestNote={notes.latestNote}
      />

      <GamesPreview
        questionCount={games.questionCount}
        totalGamesPlayed={games.totalGamesPlayed}
      />

      <WishlistPreview
        total={wishlist.total}
        done={wishlist.done}
      />

      <LettersPreview
        totalCount={letters.totalCount}
      />
    </div>
  );
}
