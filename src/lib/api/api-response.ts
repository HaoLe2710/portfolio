import { ApiError } from "./api-error";

type UnknownRecord = Record<string, unknown>;

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  error: ApiErrorPayload | null;
  timestamp?: string;
  path?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  const details = value.details;

  return (
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (details === undefined || isRecord(details))
  );
}

export function isApiResponse<T = unknown>(
  value: unknown
): value is ApiResponse<T> {
  if (!isRecord(value)) {
    return false;
  }

  const timestamp = value.timestamp;
  const path = value.path;

  return (
    typeof value.success === "boolean" &&
    typeof value.message === "string" &&
    hasOwn(value, "data") &&
    hasOwn(value, "error") &&
    (value.error === null || isApiErrorPayload(value.error)) &&
    (timestamp === undefined || typeof timestamp === "string") &&
    (path === undefined || typeof path === "string")
  );
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (!isApiResponse<T>(response)) {
    throw new ApiError("Invalid API response envelope.", {
      code: "INVALID_RESPONSE",
    });
  }

  if (!response.success) {
    throw new ApiError(
      response.error?.message || response.message || "API request failed.",
      {
        code: response.error?.code ?? "API_ERROR",
        details: response.error?.details,
        path: response.path,
        timestamp: response.timestamp,
      }
    );
  }

  return response.data as T;
}
