import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

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

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
