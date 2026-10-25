export default function HomeLoading() {
  return (
    <div className="space-y-16 md:space-y-24" aria-label="Memuat beranda">
      <div className="flex min-h-[90vh] items-center justify-center">
        <div className="w-full max-w-4xl space-y-4 px-4 text-center">
          <div className="mx-auto h-5 w-48 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-12 w-3/4 animate-pulse rounded-2xl bg-muted" />
          <div className="mx-auto h-5 w-1/2 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
