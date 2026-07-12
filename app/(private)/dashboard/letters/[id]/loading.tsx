export default function LetterDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
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
