import axios from "axios";

type UnknownRecord = Record<string, unknown>;

export type ApiErrorOptions = {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
  path?: string;
  timestamp?: string;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: Record<string, unknown>;
  readonly path?: string;
  readonly timestamp?: string;
  readonly cause?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "UNKNOWN_ERROR";
    this.status = options.status;
    this.details = options.details;
    this.path = options.path;
    this.timestamp = options.timestamp;
    this.cause = options.cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDetails(value: unknown): value is Record<string, unknown> {
  return value === undefined || isRecord(value);
}

function getStatusCode(status?: number) {
  if (status === 401) {
    return "UNAUTHORIZED";
  }

  if (status === 403) {
    return "FORBIDDEN";
  }

  if (status === 404) {
    return "NOT_FOUND";
  }

  if (status === 409) {
    return "CONFLICT";
  }

  if (typeof status === "number") {
    return "HTTP_ERROR";
  }

  return "NETWORK_ERROR";
}

function getBackendEnvelopeError(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  const error = data.error;

  if (!isRecord(error)) {
    return null;
  }

  const code = error.code;
  const message = error.message;
  const details = error.details;

  if (!isString(code) || !isString(message) || !isDetails(details)) {
    return null;
  }

  return {
    code,
    details,
    message,
    path: isString(data.path) ? data.path : undefined,
    timestamp: isString(data.timestamp) ? data.timestamp : undefined,
  };
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const backendError = getBackendEnvelopeError(error.response?.data);

    if (backendError) {
      return new ApiError(backendError.message, {
        code: backendError.code,
        details: backendError.details,
        path: backendError.path,
        status,
        timestamp: backendError.timestamp,
      });
    }

    if (error.response) {
      return new ApiError(error.message || "API request failed.", {
        code: getStatusCode(status),
        status,
      });
    }

    return new ApiError(
      error.message || "Network error while contacting the API.",
      {
        code: "NETWORK_ERROR",
      }
    );
  }

  if (error instanceof Error) {
    return new ApiError(error.message || "Unexpected API error.", {
      cause: error,
      code: "UNKNOWN_ERROR",
    });
  }

  return new ApiError("Unexpected API error.", {
    cause: error,
    code: "UNKNOWN_ERROR",
  });
}
