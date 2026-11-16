import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

// Page-level protection. Every API Route Handler also checks the role itself (defence in depth).
const RULES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/organizer", roles: ["ORGANIZER", "ADMIN"] },
  { prefix: "/my-bookings", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
  { prefix: "/checkout", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
  { prefix: "/shows", roles: ["CUSTOMER", "ORGANIZER", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(session.role)) return NextResponse.redirect(new URL("/events?denied=1", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/organizer/:path*", "/my-bookings/:path*", "/checkout/:path*", "/shows/:path*"] };
