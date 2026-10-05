/** External JSON may be absent or malformed; consumers validate collection fields. */
export function objectPayload<T extends object>(value: unknown): T | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : null;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
