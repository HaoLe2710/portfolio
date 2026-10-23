export type AdminErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;

export class AdminError extends Error {
  constructor(
    readonly status: AdminErrorStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AdminError";
  }
}
