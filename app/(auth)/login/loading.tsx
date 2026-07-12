export default function LoginLoading() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mx-auto h-9 w-40 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto mt-2 h-4 w-56 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
