/**
 * Canonical API error shape.
 *
 * Kept separate from `apiClient` so pure guards and cache helpers can inspect
 * an HTTP failure without loading the Firebase-backed transport.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
