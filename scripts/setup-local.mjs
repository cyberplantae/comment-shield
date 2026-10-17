import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { parse } from "dotenv";

// Configure only this project. Never start the worker or contact Instagram.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, ".env");
let text = existsSync(path) ? readFileSync(path, "utf8") : readFileSync(resolve(root, ".env.example"), "utf8");
const existing = parse(text);
if (existsSync(resolve(root, ".env.local")) && parse(readFileSync(resolve(root, ".env.local"))).ADMIN_PASSWORD) {
  console.log("A password is configured in .env.local. Keep using that password; no files were changed.");
  process.exit(0);
}
const set = (key, value) => {
  const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, "gm");
  text = pattern.test(text) ? text.replace(pattern, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
};
let password = existing.ADMIN_PASSWORD;
if (password && password.length < 24) {
  console.error("Your existing ADMIN_PASSWORD is too short. No files were changed. Ask the person who installed this app to replace it with a unique password of at least 24 characters.");
  process.exit(1);
}
if (!password) { password = randomBytes(24).toString("base64url"); set("ADMIN_PASSWORD", password); }
if (!existing.TOKEN_ENCRYPTION_KEY) set("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
writeFileSync(path, text, { mode: 0o600 }); chmodSync(path, 0o600);
console.log("\nYour keeper’s key is ready.\n\nYour Comment Shield password:\n\n" + password + "\n\n1. Save this password in your password manager.\n2. Restart Comment Shield.\n3. Return to the browser and sign in.\n\nKeep this password private. This setup did not connect Instagram or start moderation.\n");
