export type ApiErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404,
    readonly code: Extract<ApiErrorCode, "VALIDATION_ERROR" | "NOT_FOUND">,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}
