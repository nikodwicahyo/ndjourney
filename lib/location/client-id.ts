/** Client-generated idempotency key shared by the web and native engines. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Non-UUID fallback for insecure contexts; the server accepts any unique
  // 8–64 char string.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
