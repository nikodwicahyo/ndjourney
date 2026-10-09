// Single skeleton for the letter detail route AND LetterViewer's own
// loading state — same shape in both, so navigation shows one continuous
// skeleton instead of two different ones flashing in sequence.
export default function LetterDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat surat">
      <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded-full bg-muted" />
        ))}
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
