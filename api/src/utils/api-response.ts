import type { Context } from "hono";
import type { WorkerEnv } from "../types/env";

export type SuccessEnvelope<T> = {
  success: true;
  message: string;
  data: T;
  error: null;
  timestamp: string;
  path: string;
};

export type ErrorEnvelope = {
  success: false;
  message: string;
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
};

export function successResponse<T>(
  context: Context<WorkerEnv>,
  data: T,
  message = "Success",
  status: 200 | 201 = 200
) {
  const body: SuccessEnvelope<T> = {
    success: true,
    message,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    path: context.req.path,
  };

  return context.json(body, status);
}

export function errorResponse(
  context: Context<WorkerEnv>,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const body: ErrorEnvelope = {
    success: false,
    message,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
    path: context.req.path,
  };

  return context.json(body, status);
}
