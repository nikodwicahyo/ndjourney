export default function GamesLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="h-9 w-48 animate-pulse rounded-full bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
