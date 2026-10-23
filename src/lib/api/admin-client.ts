import { ApiError } from "./api-error";
import type { ApiQueryParams } from "./public-client";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T | null;
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
  path?: string;
  timestamp?: string;
};

type AdminMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

async function requestAdmin<TResponse>(
  method: AdminMethod,
  path: string,
  options: { body?: unknown; params?: ApiQueryParams } = {}
): Promise<TResponse> {
  const url = new URL(`/api/admin${path.startsWith("/") ? path : `/${path}`}`, window.location.origin);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
    });
  } catch (error) {
    throw new ApiError("Could not connect to the admin service.", {
      code: "NETWORK_ERROR",
      cause: error,
    });
  }

  let envelope: ApiEnvelope<TResponse> | null = null;
  try {
    envelope = await response.json() as ApiEnvelope<TResponse>;
  } catch {
    throw new ApiError("The admin service returned an invalid response.", {
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  if (!response.ok || !envelope.success || envelope.data === null) {
    throw new ApiError(envelope.error?.message ?? `Admin request failed (${response.status}).`, {
      code: envelope.error?.code ?? "HTTP_ERROR",
      details: envelope.error?.details,
      path: envelope.path,
      status: response.status,
      timestamp: envelope.timestamp,
    });
  }

  return envelope.data;
}

export function adminPublicPost<TResponse, TBody = unknown>(path: string, body?: TBody) {
  return requestAdmin<TResponse>("POST", path, { body });
}

export function adminGet<T>(path: string, params?: ApiQueryParams) {
  return requestAdmin<T>("GET", path, { params });
}

export function adminPost<TResponse, TBody = unknown>(path: string, body?: TBody) {
  return requestAdmin<TResponse>("POST", path, { body });
}

export function adminPut<TResponse, TBody = unknown>(path: string, body?: TBody) {
  return requestAdmin<TResponse>("PUT", path, { body });
}

export function adminPatch<TResponse, TBody = unknown>(path: string, body?: TBody) {
  return requestAdmin<TResponse>("PATCH", path, { body });
}

export function adminDelete<TResponse = void>(path: string, body?: unknown) {
  return requestAdmin<TResponse>("DELETE", path, { body });
}
