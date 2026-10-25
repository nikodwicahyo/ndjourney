// Transform-only entrance. CSS (not JS) so the page is painted immediately on
// first load — a JS-driven opacity:0 wrapper held LCP hostage until hydration.
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
