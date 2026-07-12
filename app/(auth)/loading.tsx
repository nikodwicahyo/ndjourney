export default function AuthLoading() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-secondary/30" />
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-6 w-48 animate-pulse rounded-md bg-muted" />
          <div className="mx-auto h-4 w-64 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <div className="h-3 w-8 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
