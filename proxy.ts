import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPublicPath, isAuthPath } from "@/lib/route-guards";

export { isPublicPath, isAuthPath };

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) return NextResponse.next();

  let session = null;
  try {
    session = await auth();
  } catch {
    // fail-open for public/auth pages on auth outage — private routes still redirect below.
    if (isPublicPath(pathname) || isAuthPath(pathname)) return NextResponse.next();
    session = null;
  }
  const isAuthenticated = !!session?.user;

  if (isAuthPath(pathname)) {
    if (isAuthenticated && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    loginUrl.searchParams.set("reason", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/data|_next/image|favicon.ico|favicon.svg|manifest.json|version.json|offline.html|icons|screenshots|images|sw.js|workbox-.*).*)",
  ],
};
