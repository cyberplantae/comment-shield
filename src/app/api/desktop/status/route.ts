import { requireOwner } from "@/lib/auth";
import { workerState } from "@/lib/desktop/worker";
export async function GET() { await requireOwner(); return Response.json({ lastChecked: workerState.lastChecked, busy: workerState.busy, error: workerState.error }); }
