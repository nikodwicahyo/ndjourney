export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
