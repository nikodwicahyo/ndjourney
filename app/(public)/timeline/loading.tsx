export default function TimelineLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-56 animate-pulse rounded-full bg-muted" />
        <div className="mt-1 h-4 w-64 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 animate-pulse rounded-full bg-muted" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
