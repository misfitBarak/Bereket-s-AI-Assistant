import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static build assets)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Authentication endpoints & Login page
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me"
  ) {
    // If user is already authenticated and visits /login, redirect directly to dashboard
    if (pathname === "/login") {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      const session = await verifySessionToken(token);
      if (session.valid) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Telegram Webhook: Bypasses browser session cookie
  // (Protected via its own cryptographic X-Telegram-Bot-Api-Secret-Token & allowed user ID checks)
  if (pathname === "/api/telegram/webhook") {
    return NextResponse.next();
  }

  // 3. Scheduler Tick: Bypasses browser session cookie
  // (Protected via its own Bearer CRON_SECRET header in production)
  if (pathname === "/api/scheduler/tick") {
    return NextResponse.next();
  }

  // 4. Session Verification for all other pages & API routes
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session.valid) {
    // For API routes, return HTTP 401 JSON immediately
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Valid session required",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    // For web page requests, redirect to /login
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Session verified: continue request
  return NextResponse.next();
}
