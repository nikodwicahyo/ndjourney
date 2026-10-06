// Pure route-guard predicates shared by proxy.ts and tests.
// Kept dependency-free: proxy.ts runs on the edge runtime, unit tests on node.
const publicRoutes = ["/", "/gallery", "/timeline", "/letters", "/games", "/notes", "/wishlist"];
const authRoutes = ["/login", "/auth-error", "/invite"];

export function isPublicPath(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(route + "/");
  });
}

export function isAuthPath(pathname: string): boolean {
  return authRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(route + "/");
  });
}
