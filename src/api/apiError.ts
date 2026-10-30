/**
 * Canonical API error shape.
 *
 * Kept separate from `apiClient` so pure guards and cache helpers can inspect
 * an HTTP failure without loading the Firebase-backed transport.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Structured error details from the API body (e.g. a 409 carrying current state). */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
