export default function PublicLettersLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-9 w-56 animate-pulse rounded-full bg-muted" />
        <div className="mt-1 h-4 w-48 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 rounded-full bg-muted" />
              <div className="h-4 w-32 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
