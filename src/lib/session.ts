import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export const SESSION_COOKIE = "shield_session";
export const SESSION_SECONDS = 12 * 60 * 60;
function secret() { const value = process.env.ADMIN_PASSWORD; return value && value.length >= 24 ? value : null; }
export function authConfigured() { return secret() !== null; }
export function passwordMatches(value: string) {
  const expected = secret();
  return !!expected && timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(expected).digest());
}
export function createSession(now = Date.now()) {
  const key = secret(); if (!key) throw new Error("Set ADMIN_PASSWORD to at least 24 characters");
  const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${expires}.${createHmac("sha256", key).update(`owner:${expires}`).digest("hex")}`;
}
export function validSession(value: string | undefined, now = Date.now()): boolean {
  const key = secret(); if (!key || !value || !/^\d{10}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, signature] = value.split(".");
  const expiry = Number(expires); const seconds = Math.floor(now / 1000);
  if (expiry <= seconds || expiry > seconds + SESSION_SECONDS) return false;
  const expected = createHmac("sha256", key).update(`owner:${expires}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature!, "hex"));
}
export function trustedOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false;
  try { return origin === new URL(process.env.PUBLIC_BASE_URL || requestUrl).origin; } catch { return false; }
}
