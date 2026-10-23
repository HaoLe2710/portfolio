import type { MiddlewareHandler } from "hono";
import type { WorkerEnv } from "../types/env";

export const requestLogger: MiddlewareHandler<WorkerEnv> = async (
  context,
  next
) => {
  const startedAt = Date.now();
  await next();

  console.log(
    JSON.stringify({
      event: "http_request",
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    })
  );
};
