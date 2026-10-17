import { cookies } from "next/headers";
import { SESSION_COOKIE, validSession } from "./session";
export async function requireOwner() {
  if (!validSession((await cookies()).get(SESSION_COOKIE)?.value)) throw new Error("Sign in to continue");
}
