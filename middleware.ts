import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected routes that require authentication
const protectedRoutes = ["/profile", "/admin", "/my-prompts"];

// Admin-only routes that require admin permissions
const adminRoutes = ["/admin"];

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Redirect Amplify URLs directly to www.gravyprompts.com
  if (host.includes("amplifyapp.com")) {
    const url = request.nextUrl.clone();
    url.host = "www.gravyprompts.com";
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  // Optional: Also redirect gravyprompts.com to www.gravyprompts.com
  if (host === "gravyprompts.com") {
    const url = request.nextUrl.clone();
    url.host = "www.gravyprompts.com";
    return NextResponse.redirect(url, 301);
  }

  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // Check for auth-related cookies that indicate a logged-in session
    const cognitoTokens = request.cookies.get("CognitoIdentityServiceProvider");
    const hasAuthCookies = Array.from(request.cookies.getAll()).some(
      (cookie) => cookie.name.includes("CognitoIdentityServiceProvider")
    );

    if (!hasAuthCookies) {
      // Redirect to login if no auth cookies found
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
