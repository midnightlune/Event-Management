import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/http";

export type Role = "CUSTOMER" | "ORGANIZER" | "ADMIN";
export type Session = { userId: number; role: Role; name: string };

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (see .env.example)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(session: Session) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: Number(payload.userId), role: payload.role as Role, name: String(payload.name) };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  const token = await createSessionToken(session);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from browser JavaScript
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

/** Use at the top of a Route Handler. Throws 401/403 HttpErrors that handleError() turns into responses. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please log in first.");
  if (roles.length && !roles.includes(session.role)) throw new HttpError(403, "You do not have access to this action.");
  return session;
}
