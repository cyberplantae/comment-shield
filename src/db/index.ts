import "dotenv/config";
import postgres from "postgres";
import { drizzle as remoteDrizzle } from "drizzle-orm/postgres-js";
import { drizzle as localDrizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

function createDatabase() {
  if (process.env.SHIELD_DESKTOP === "1") {
    if (!process.env.SHIELD_DATA_DIR) throw new Error("Desktop data directory is missing");
    const local = new PGlite(process.env.SHIELD_DATA_DIR + "/database");
    const db = localDrizzle(local, { schema });
    const ready = migrate(db, { migrationsFolder: process.env.SHIELD_MIGRATIONS_DIR || "./drizzle" });
    return { db, ready, close: () => local.close() };
  }
  const client = postgres(process.env.DATABASE_URL || "postgres://localhost:5432/comment_shield", { max: 10 });
  return { db: remoteDrizzle(client, { schema }), ready: Promise.resolve(), close: () => client.end() };
}
// Next bundles routes separately; one process must share one embedded database.
const globalDB = globalThis as typeof globalThis & { shieldDatabase?: ReturnType<typeof createDatabase> };
const connection = globalDB.shieldDatabase ??= createDatabase();
export const db: PgDatabase<PgQueryResultHKT, typeof schema> = connection.db;
export const databaseReady = connection.ready;
export const closeDatabase = connection.close;
export { schema };
