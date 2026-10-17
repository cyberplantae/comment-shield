import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, trustedOrigin, validSession } from "@/lib/session";
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/webhooks/meta") return NextResponse.next();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !trustedOrigin(request.headers.get("origin"), request.url)) {
    return NextResponse.json({ error: "Request origin not allowed" }, { status: 403 });
  }
  if (path === "/login" || path === "/api/session") return NextResponse.next();
  if (!validSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return path.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in to continue" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
