export type GotyErrorCode = "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

export class GotyError extends Error {
  constructor(
    readonly code: GotyErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "GotyError";
  }
}
