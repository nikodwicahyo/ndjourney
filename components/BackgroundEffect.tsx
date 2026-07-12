export default function BackgroundEffect() {
  return (
    <div suppressHydrationWarning className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true" style={{ zIndex: -10 }}>
      <div
        className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-pink-200/25 blur-[120px] dark:bg-rose-950/35"
        style={{ animation: "orb-drift-1 20s ease-in-out infinite" }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-rose-200/20 blur-[150px] dark:bg-pink-950/30"
        style={{ animation: "orb-drift-2 25s ease-in-out infinite" }}
      />
      <div
        className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-200/15 blur-[120px] dark:bg-purple-950/25"
        style={{ animation: "orb-pulse 15s ease-in-out infinite" }}
      />
      <div
        className="absolute top-1/3 right-1/4 h-[200px] w-[200px] rounded-full bg-amber-100/20 blur-[80px] dark:bg-amber-950/25"
        style={{ animation: "orb-drift-3 18s ease-in-out infinite" }}
      />
      <div
        className="absolute -bottom-20 left-1/4 h-[300px] w-[300px] rounded-full bg-fuchsia-200/15 blur-[100px] dark:bg-fuchsia-950/25"
        style={{ animation: "orb-drift-4 22s ease-in-out infinite" }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "var(--heart-pattern)",
          backgroundRepeat: "repeat",
          zIndex: 1,
        }}
      />
    </div>
  );
}
