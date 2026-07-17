import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sessionTokenFor(password: string): string {
  return sha256(password);
}

export function isCorrectPassword(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !candidate) return false;
  const a = Buffer.from(sha256(candidate));
  const b = Buffer.from(sha256(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidSessionCookie(cookieValue: string | undefined): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !cookieValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(sessionTokenFor(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}
