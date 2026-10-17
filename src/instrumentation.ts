export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SHIELD_DESKTOP === "1") {
    const { databaseReady } = await import("@/db");
    await databaseReady;
    if (process.env.SHIELD_TEST_MODE !== "1") {
      const { startDesktopWorker } = await import("@/lib/desktop/worker");
      startDesktopWorker();
    }
  }
}
