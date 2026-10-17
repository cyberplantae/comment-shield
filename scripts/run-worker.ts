import { main } from "../src/worker/index";
void main().catch(() => { console.error("Worker stopped. Check your configuration."); process.exit(1); });
