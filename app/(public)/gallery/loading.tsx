export default function GalleryLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
      <div className="h-6 w-64 animate-pulse rounded-full bg-muted" />
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="mb-3 aspect-[3/4] animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
