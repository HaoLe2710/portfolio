import type { Context } from "hono";
import type { WorkerEnv } from "../types/env";
import { randomToken } from "./password";

export async function writeAudit(
  context: Context<WorkerEnv>,
  entry: {
    action: string;
    actorId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  }
) {
  await context.env.DB.prepare(
    `INSERT INTO admin_audit_logs
      (id, actor_id, action, entity_type, entity_id, request_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomToken(18),
      entry.actorId ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      context.req.header("cf-ray") ?? randomToken(12),
      JSON.stringify(entry.metadata ?? {})
    )
    .run();
}
