import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, createSession, passwordMatches, SESSION_COOKIE, SESSION_SECONDS, trustedOrigin } from "@/lib/session";
export async function POST(request: NextRequest) {
  if (!trustedOrigin(request.headers.get("origin"), request.url)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData();
  const target = new URL(process.env.PUBLIC_BASE_URL || request.url);
  target.pathname = "/login"; target.search = "";
  if (form.get("action") === "logout") {
    const response = NextResponse.redirect(target, 303); response.cookies.delete(SESSION_COOKIE); return response;
  }
  if (!authConfigured()) return NextResponse.json({ error: "The owner must configure ADMIN_PASSWORD (at least 24 characters)." }, { status: 503 });
  const password = form.get("password");
  // A high-entropy generated password is required; fixed delay also slows online guessing.
  await new Promise(resolve => setTimeout(resolve, 500));
  if (typeof password !== "string" || password.length > 512 || !passwordMatches(password)) {
    target.searchParams.set("error", "1"); return NextResponse.redirect(target, 303);
  }
  target.pathname = "/dashboard";
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(SESSION_COOKIE, createSession(), { httpOnly: true, secure: target.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
