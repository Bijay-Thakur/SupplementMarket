/** Silent bot check. A filled hidden field is discarded without creating an account. */
export function honeypotTripped(body: Record<string, unknown>): boolean {
  const value = body.company ?? body.website;
  return typeof value === "string" && value.trim().length > 0;
}
