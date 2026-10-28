// Kept as a no-op seam: LayoutTransition already owns the route entrance
// (CSS `page-enter`). Pages keep wrapping their content without nesting a
// second animation on top of it.
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
