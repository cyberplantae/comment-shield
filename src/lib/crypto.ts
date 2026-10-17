import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Access tokens are bearer credentials for a creator's whole comment surface.
 * A database dump must not be enough to read or moderate their account, so
 * tokens are sealed with AES-256-GCM before they ever hit a column.
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  }
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // iv.tag.ciphertext — self-describing, so rotation can version this later.
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptToken(sealed: string): string {
  const [ivB64, tagB64, dataB64] = sealed.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed sealed token");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
