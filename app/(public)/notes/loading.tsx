export default function NotesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-56 animate-pulse rounded-full bg-muted" />
        <div className="mt-1 h-4 w-64 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mx-auto max-w-lg space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
