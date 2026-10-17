import type { schema } from "@/db";
import type { Policy } from "./rules";

/**
 * Map a stored policy row to the pure Policy shape the rules engine takes.
 * One place, so adding a knob can't silently work in the worker and not in
 * the settings re-apply path.
 */
export function policyFromRow(row: typeof schema.policies.$inferSelect): Policy {
  return {
    autoHideAtOrAbove: row.autoHideAtOrAbove,
    surfaceAtOrAbove: row.surfaceAtOrAbove,
    allowAutoDelete: row.allowAutoDelete,
    allowlistHandles: row.allowlistHandles,
    blocklistHandles: row.blocklistHandles,
    categoryOverrides: row.categoryOverrides,
    protectedIdentities: row.protectedIdentities,
    identityAttackAction: row.identityAttackAction,
  };
}
