import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/auth";

// Whole-dashboard password gate. Deliberately simple (see plan): one
// DASHBOARD_PASSWORD env var, one hash-check cookie, no session store,
// no signing secret. This is an "optimistic check" per Next.js's own
// guidance (proxy runs on every route incl. prefetches, so only read the
// cookie -- no DB calls here).
export default function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = isValidSessionCookie(cookie);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!authed && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (authed && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// The cron route guards itself with CRON_SECRET (Vercel Cron calls it
// directly, not through a browser session) -- everything else is gated.
export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
