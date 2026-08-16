import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;

  const wantsOps = pathname.startsWith("/ops");
  const wantsPortal = pathname.startsWith("/portal");

  if (!wantsOps && !wantsPortal) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (wantsOps && session.role !== "OPS") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  if (wantsPortal && session.role !== "CLIENT") {
    return NextResponse.redirect(new URL("/ops", request.url));
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ["/ops/:path*", "/portal/:path*"],
};
