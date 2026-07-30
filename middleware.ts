import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export default async function middleware(req: NextRequest) {
  // Allow demo mode without authentication
  const isDemo = req.nextUrl.searchParams.get("demo") === "true";
  if (isDemo) {
    return NextResponse.next();
  }

  try {
    // Try to get the session using auth
    const session = await auth();
    const isLoggedIn = !!session;
    const pathname = req.nextUrl.pathname;
    const isAuthPage = pathname === "/login" || pathname === "/";
    // Public pages — always accessible without login (needed for Google verification)
    const isPublicPage =
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/terms");
    const isProtectedRoute =
      !isPublicPage && (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/job") ||
        pathname.startsWith("/saved-jobs") ||
        pathname.startsWith("/timeline") ||
        pathname.startsWith("/calendar") ||
        pathname.startsWith("/insights") ||
        pathname.startsWith("/settings")
      );

    if (isAuthPage && isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isProtectedRoute && !isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  } catch {
    // If auth fails (e.g., missing config), allow everything
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
